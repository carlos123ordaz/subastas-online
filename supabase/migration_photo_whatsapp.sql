-- Ejecuta esto en el SQL Editor de Supabase

-- 1. Agregar columna image_url a lots
ALTER TABLE public.lots ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. Agregar whatsapp_number a auctions
ALTER TABLE public.auctions ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;

-- 3. Crear bucket de almacenamiento para fotos de productos
INSERT INTO storage.buckets (id, name, public)
VALUES ('lot-images', 'lot-images', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Política: cualquiera puede ver las imágenes (bucket público)
CREATE POLICY "lot-images: lectura publica"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'lot-images');

-- 5. Política: solo admins pueden subir imágenes
CREATE POLICY "lot-images: solo admin puede subir"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'lot-images' AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 6. Política: solo admins pueden eliminar/actualizar imágenes
CREATE POLICY "lot-images: solo admin puede modificar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'lot-images' AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
