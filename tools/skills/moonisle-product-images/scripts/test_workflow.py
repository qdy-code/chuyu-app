import base64
import copy
import json
from pathlib import Path
import tempfile
import unittest

import workflow


class WorkflowTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.brand = json.loads((workflow.SKILL / 'references/brand.json').read_text())
        self.job = {'id': 'nail-01', 'mode': 'concept', 'category': 'nail', 'brief': '五枚灰蓝甲片'}
        self.image = self.root / 'reference.png'
        self.image.write_bytes(base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1cAAAAASUVORK5CYII='))

    def compile(self, job):
        return workflow.compile_job(job, self.root, self.brand)

    def prepare(self, jobs=None):
        batch = self.root / 'batch.json'
        batch.write_text(json.dumps({'jobs': jobs or [self.job]}))
        workflow.prepare(batch, self.root / 'output')
        return self.root / 'output' / self.job['id']

    def test_concept_omits_reference_arguments_and_cannot_be_product(self):
        _, _, request, manifest = self.compile(self.job)
        self.assertNotIn('referenced_image_paths', request)
        self.assertEqual(manifest['classification'], 'AI 概念图')
        self.assertIsNone(manifest['output'])

    def test_product_requires_identity_inputs(self):
        job = dict(self.job, mode='product-edit')
        with self.assertRaises(ValueError):
            self.compile(job)
        job.update(sku='real-sku', preserve=['颜色和件数'], edit_scope='背景', product_images=['reference.png'])
        _, prompt, request, manifest = self.compile(job)
        self.assertIn('Allowed changes ONLY: 背景', prompt)
        self.assertEqual(request['referenced_image_paths'], [str(self.image)])
        self.assertEqual(manifest['references'][0]['sha256'], workflow.digest(self.image))

    def test_reference_roles_are_ordered(self):
        job = dict(self.job, mode='product-edit', sku='a', preserve=['颜色'], edit_scope='光线',
                   product_images=['reference.png'], style_images=['reference.png'])
        _, prompt, _, manifest = self.compile(job)
        self.assertEqual([r['role'] for r in manifest['references']], ['product', 'style'])
        self.assertIn('Image 1: edit target', prompt)
        self.assertIn('Image 2: style reference ONLY', prompt)

    def test_missing_reference_and_path_traversal_rejected(self):
        for job in [dict(self.job, style_images=['missing.png']), dict(self.job, id='../escape')]:
            with self.assertRaises(ValueError):
                self.compile(job)

    def test_invalid_batch_creates_no_partial_output(self):
        for jobs in [[self.job, copy.deepcopy(self.job)], [self.job, dict(self.job, id='bad', category='unknown')]]:
            with self.assertRaises(ValueError):
                self.prepare(jobs)
            self.assertFalse((self.root / 'output').exists())

    def test_capture_is_lossless_nonoverwriting_and_pending_review(self):
        folder = self.prepare()
        workflow.capture(folder, self.image)
        self.assertEqual((folder / 'original.png').read_bytes(), self.image.read_bytes())
        with self.assertRaises(ValueError):
            workflow.capture(folder, self.image)
        manifest = json.loads((folder / 'manifest.json').read_text())
        review = json.loads((folder / 'review.json').read_text())
        self.assertEqual(manifest['status'], 'generated-pending-review')
        self.assertEqual(review['verdict'], 'pending')
        self.assertFalse(review['approved_for_publication'])
        with self.assertRaises(FileExistsError):
            self.prepare()

    def test_corrupt_output_not_archived(self):
        folder = self.prepare()
        self.image.write_text('not an image')
        with self.assertRaises(ValueError):
            workflow.capture(folder, self.image)
        self.assertFalse(list(folder.glob('original.*')))


if __name__ == '__main__':
    unittest.main()
