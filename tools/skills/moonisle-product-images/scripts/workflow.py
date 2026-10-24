#!/usr/bin/env python3
"""Prepare image_gen jobs and archive results. No network or model calls."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import sys
from datetime import datetime, timezone


SKILL = Path(__file__).resolve().parents[1]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def now():
    return datetime.now(timezone.utc).isoformat()


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def strings(job, key):
    value = job.get(key, [])
    if not isinstance(value, list) or any(not isinstance(v, str) or not v.strip() for v in value):
        raise ValueError(f'{key} must be a list of nonempty strings')
    return value


def compile_job(job, base, brand):
    if not isinstance(job, dict):
        raise ValueError('Each job must be an object')
    allowed = {'id', 'sku', 'mode', 'category', 'shot', 'brief', 'facts', 'preserve',
               'edit_scope', 'product_images', 'style_images'}
    if set(job) - allowed:
        raise ValueError(f'Unknown job fields: {sorted(set(job) - allowed)}')
    ident = job.get('id', '')
    if not isinstance(ident, str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,95}', ident):
        raise ValueError('id must be 1-96 safe filename characters')
    mode, category, shot = job.get('mode'), job.get('category'), job.get('shot', 'hero')
    if mode not in ('concept', 'product-edit'):
        raise ValueError(f'{ident}: invalid mode')
    if category not in brand['categories'] or shot not in brand['shots']:
        raise ValueError(f'{ident}: invalid category or shot')
    brief = job.get('brief')
    if not isinstance(brief, str) or not brief.strip():
        raise ValueError(f'{ident}: brief is required')
    facts, preserve = strings(job, 'facts'), strings(job, 'preserve')
    product, style = strings(job, 'product_images'), strings(job, 'style_images')
    scope = job.get('edit_scope', '')
    if not isinstance(scope, str):
        raise ValueError('edit_scope must be a string')
    if mode == 'product-edit':
        if not isinstance(job.get('sku'), str) or not job['sku'].strip() or not preserve or not product or not scope.strip():
            raise ValueError(f'{ident}: product-edit requires sku, preserve, edit_scope and product_images')
    elif product or scope:
        raise ValueError(f'{ident}: product images/edit_scope require product-edit mode')
    refs = []
    for role, names in [('product', product), ('style', style)]:
        for name in names:
            path = (base / Path(name).expanduser()).resolve()
            if not path.is_file():
                raise ValueError(f'{ident}: missing reference {path}')
            if path.suffix.lower() not in ('.png', '.jpg', '.jpeg', '.webp'):
                raise ValueError(f'{ident}: unsupported reference format {path.suffix}')
            refs.append({'role': role, 'path': str(path), 'sha256': digest(path)})
    lines = [
        'Use case: ' + ('precise-object-edit' if mode == 'product-edit' else 'product-mockup'),
        f'Asset type: {brand["brand"]} / {category} / {shot}',
        'Primary request: ' + brief,
        'Style/medium: ' + brand['shared'],
        'Category details: ' + brand['categories'][category],
        'Composition/framing: ' + brand['shots'][shot],
    ]
    if refs:
        roles = []
        for index, ref in enumerate(refs, 1):
            meaning = 'edit target/product identity, preserve the same item' if ref['role'] == 'product' else 'style reference ONLY; do not copy its product or text'
            roles.append(f'Image {index}: {meaning}')
        lines.append('Input images: ' + '; '.join(roles))
    if facts:
        lines.append('User-provided facts: ' + '; '.join(facts))
    if preserve:
        lines.append('Must preserve: ' + '; '.join(preserve))
    if mode == 'product-edit':
        lines += ['Allowed changes ONLY: ' + scope,
                  'Constraints: 保持原商品颜色、结构、件数、材质特征与比例；不能改变设计、增加配件/花量，不能发明隐藏角度；参考图优先于风格描述。']
    else:
        lines.append('Constraints: AI 新款概念设计，不表示真实商品或门店案例；图片本身无字。')
    lines.append('Avoid: ' + brand['avoid'])
    prompt = '\n'.join(lines) + '\n'
    request = {'prompt': prompt, 'transparent_background': False}
    if refs:
        request['referenced_image_paths'] = [r['path'] for r in refs]
    manifest = {'schema_version': 1, 'created_at': now(), 'status': 'prepared',
                'engine': 'builtin-image_gen', 'classification': 'AI 概念图' if mode == 'concept' else 'AI 辅助实物优化图',
                'input': job, 'references': refs, 'brand_snapshot': brand,
                'prompt_sha256': hashlib.sha256(prompt.encode()).hexdigest(), 'output': None}
    return ident, prompt, request, manifest


def prepare(batch, out):
    data = json.loads(batch.read_text(encoding='utf-8'))
    if not isinstance(data, dict) or set(data) != {'jobs'} or not isinstance(data['jobs'], list) or not data['jobs']:
        raise ValueError('Batch must contain a nonempty jobs list only')
    brand = json.loads((SKILL / 'references/brand.json').read_text(encoding='utf-8'))
    jobs = [compile_job(job, batch.parent, brand) for job in data['jobs']]
    ids = [job[0] for job in jobs]
    if len(ids) != len(set(ids)):
        raise ValueError('Duplicate job ids')
    # Validate the entire batch before creating anything.
    out.mkdir(parents=True, exist_ok=False)
    for ident, prompt, request, manifest in jobs:
        folder = out / ident
        folder.mkdir()
        (folder / 'prompt.txt').write_text(prompt, encoding='utf-8')
        write_json(folder / 'tool-request.json', request)
        write_json(folder / 'manifest.json', manifest)
        write_json(folder / 'review.json', {
            'reviewer': None, 'verdict': 'pending', 'approved_for_publication': False,
            'checks': {key: 'pending' for key in ['brand_composition', 'subject_details', 'artifacts', 'reference_fidelity', 'crop_usability']},
            'observations': []})
    write_json(out / 'batch-manifest.json', {'created_at': now(), 'source': str(batch), 'jobs': ids})
    return {'status': 'prepared', 'jobs': len(jobs), 'directory': str(out), 'model_calls': 0}


def capture(folder, source):
    manifest_path = folder / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    if manifest['output'] is not None or list(folder.glob('original.*')):
        raise ValueError('Output already exists; use a new job id for another version')
    suffix = source.suffix.lower()
    if suffix not in ('.png', '.jpg', '.jpeg', '.webp'):
        raise ValueError('Output must be PNG, JPEG or WebP')
    # Check signatures; full visual/decoder checks belong to image inspection.
    with source.open('rb') as stream:
        head = stream.read(16)
    valid = (suffix == '.png' and head.startswith(b'\x89PNG\r\n\x1a\n')) or (suffix in ('.jpg', '.jpeg') and head.startswith(b'\xff\xd8\xff')) or (suffix == '.webp' and head[:4] == b'RIFF' and head[8:12] == b'WEBP')
    if not valid:
        raise ValueError('Image header does not match its extension')
    dest = folder / ('original' + suffix)
    with source.open('rb') as src, dest.open('xb') as dst:
        shutil.copyfileobj(src, dst)
    manifest['status'] = 'generated-pending-review'
    manifest['output'] = {'path': dest.name, 'source': str(source), 'sha256': digest(dest), 'bytes': dest.stat().st_size, 'captured_at': now()}
    write_json(manifest_path, manifest)
    return {'status': manifest['status'], 'image': str(dest)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    prep = sub.add_parser('prepare')
    prep.add_argument('--batch', type=Path, required=True)
    prep.add_argument('--out', type=Path, required=True)
    cap = sub.add_parser('capture')
    cap.add_argument('--job', type=Path, required=True)
    cap.add_argument('--image', type=Path, required=True)
    args = parser.parse_args()
    try:
        result = prepare(args.batch.expanduser().resolve(), args.out.expanduser().resolve()) if args.command == 'prepare' else capture(args.job.expanduser().resolve(), args.image.expanduser().resolve())
    except (ValueError, OSError, KeyError, TypeError) as error:
        parser.exit(1, f'Error: {error}\n')
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
