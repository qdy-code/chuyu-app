UPDATE "NailProduct"
SET "images" = ARRAY[]::TEXT[]
WHERE EXISTS (
  SELECT 1 FROM unnest("images") AS image_url WHERE image_url LIKE '/static/%'
);

UPDATE "AccessoryProduct"
SET "images" = ARRAY[]::TEXT[]
WHERE EXISTS (
  SELECT 1 FROM unnest("images") AS image_url WHERE image_url LIKE '/static/%'
);

UPDATE "FlowerProduct"
SET "images" = ARRAY[]::TEXT[]
WHERE EXISTS (
  SELECT 1 FROM unnest("images") AS image_url WHERE image_url LIKE '/static/%'
);
