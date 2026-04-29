INSERT INTO environments (id, name) VALUES
  (1, '森林'),
  (2, '水边'),
  (3, '草原')
ON CONFLICT (id) DO NOTHING;

INSERT INTO skills (id, name, subcategory) VALUES
  (1, '采集', NULL),
  (2, '乱撒', '棉花'),
  (3, '浇水', NULL),
  (4, '搬运', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO favorite_things (id, name) VALUES
  (1, '莓果'),
  (2, '花朵'),
  (3, '木材'),
  (4, '清水'),
  (5, '棉花')
ON CONFLICT (id) DO NOTHING;

INSERT INTO pokemon (id, name, environment_id) VALUES
  (1, '妙蛙种子', 1),
  (4, '小火龙', 3),
  (7, '杰尼龟', 2),
  (25, '皮卡丘', 3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO pokemon_skills (pokemon_id, skill_id) VALUES
  (1, 1),
  (1, 3),
  (4, 4),
  (7, 3),
  (25, 1),
  (25, 2)
ON CONFLICT DO NOTHING;

INSERT INTO pokemon_favorite_things (pokemon_id, favorite_thing_id) VALUES
  (1, 1),
  (1, 2),
  (4, 3),
  (7, 4),
  (25, 1),
  (25, 5)
ON CONFLICT DO NOTHING;

INSERT INTO item_categories (id, name) VALUES
  (1, '家具'),
  (2, '材料'),
  (3, '装饰')
ON CONFLICT (id) DO NOTHING;

INSERT INTO item_usages (id, name) VALUES
  (1, '栖息地配方'),
  (2, '建造'),
  (3, '装饰')
ON CONFLICT (id) DO NOTHING;

INSERT INTO acquisition_methods (id, name) VALUES
  (1, '采集'),
  (2, '制作'),
  (3, '探索')
ON CONFLICT (id) DO NOTHING;

INSERT INTO item_tags (id, name) VALUES
  (1, '自然'),
  (2, '木质'),
  (3, '柔软'),
  (4, '水域')
ON CONFLICT (id) DO NOTHING;

INSERT INTO recipes (id, name) VALUES
  (1, '木质长椅材料单'),
  (2, '棉花垫材料单')
ON CONFLICT (id) DO NOTHING;

INSERT INTO items (id, name, category_id, usage_id, recipe_id, dyeable, dual_dyeable, pattern_editable) VALUES
  (1, '原木', 2, 2, NULL, false, false, false),
  (2, '棉花', 2, 2, NULL, true, false, false),
  (3, '木质长椅', 1, 3, 1, true, true, false),
  (4, '清水瓶', 3, 1, NULL, false, false, true),
  (5, '棉花垫', 1, 3, 2, true, false, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO item_acquisition_methods (item_id, acquisition_method_id) VALUES
  (1, 1),
  (2, 1),
  (3, 2),
  (4, 3),
  (5, 2)
ON CONFLICT DO NOTHING;

INSERT INTO item_item_tags (item_id, item_tag_id) VALUES
  (1, 1),
  (1, 2),
  (2, 3),
  (3, 2),
  (4, 4),
  (5, 3)
ON CONFLICT DO NOTHING;

INSERT INTO recipe_acquisition_methods (recipe_id, acquisition_method_id) VALUES
  (1, 2),
  (2, 2)
ON CONFLICT DO NOTHING;

INSERT INTO recipe_materials (recipe_id, item_id, quantity) VALUES
  (1, 1, 6),
  (2, 2, 4)
ON CONFLICT DO NOTHING;

INSERT INTO maps (id, name) VALUES
  (1, '起始平原'),
  (2, '微风森林'),
  (3, '湖畔小径')
ON CONFLICT (id) DO NOTHING;

INSERT INTO habitats (id, name) VALUES
  (1, '绿荫营地'),
  (2, '湖边小窝')
ON CONFLICT (id) DO NOTHING;

INSERT INTO habitat_recipe_items (habitat_id, item_id, quantity) VALUES
  (1, 1, 8),
  (1, 3, 1),
  (2, 2, 3),
  (2, 4, 2)
ON CONFLICT DO NOTHING;

INSERT INTO habitat_pokemon (habitat_id, pokemon_id, map_id, time_of_day, weather, rarity) VALUES
  (1, 1, 2, '早晨', '晴天', 1),
  (1, 25, 1, '傍晚', '阴天', 2),
  (2, 7, 3, '中午', '雨天', 1),
  (2, 1, 3, '早晨', '雨天', 2)
ON CONFLICT DO NOTHING;

SELECT setval(pg_get_serial_sequence('environments', 'id'), (SELECT max(id) FROM environments));
SELECT setval(pg_get_serial_sequence('skills', 'id'), (SELECT max(id) FROM skills));
SELECT setval(pg_get_serial_sequence('favorite_things', 'id'), (SELECT max(id) FROM favorite_things));
SELECT setval(pg_get_serial_sequence('item_categories', 'id'), (SELECT max(id) FROM item_categories));
SELECT setval(pg_get_serial_sequence('item_usages', 'id'), (SELECT max(id) FROM item_usages));
SELECT setval(pg_get_serial_sequence('acquisition_methods', 'id'), (SELECT max(id) FROM acquisition_methods));
SELECT setval(pg_get_serial_sequence('item_tags', 'id'), (SELECT max(id) FROM item_tags));
SELECT setval(pg_get_serial_sequence('recipes', 'id'), (SELECT max(id) FROM recipes));
SELECT setval(pg_get_serial_sequence('items', 'id'), (SELECT max(id) FROM items));
SELECT setval(pg_get_serial_sequence('maps', 'id'), (SELECT max(id) FROM maps));
SELECT setval(pg_get_serial_sequence('habitats', 'id'), (SELECT max(id) FROM habitats));
