-- ============================================================
-- 동궐도 (東闕圖) 아카이브 Supabase 테이블 생성 및 보안 정책
-- ============================================================

-- 1. markers 테이블 생성
CREATE TABLE IF NOT EXISTS public.markers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  hanja TEXT,
  cat TEXT NOT NULL DEFAULT '건물',
  period TEXT,
  "desc" TEXT,
  x NUMERIC NOT NULL,
  y NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 2. Row Level Security (RLS) 활성화
ALTER TABLE public.markers ENABLE ROW LEVEL SECURITY;

-- 3. 모든 사용자(익명 포함) 읽기 정책
CREATE POLICY "모든 사용자 읽기 허용"
  ON public.markers
  FOR SELECT
  USING (true);

-- 4. 모든 사용자(익명 포함) 등록 정책
CREATE POLICY "모든 사용자 추가 허용"
  ON public.markers
  FOR INSERT
  WITH CHECK (true);

-- 5. 모든 사용자(익명 포함) 수정 정책
CREATE POLICY "모든 사용자 수정 허용"
  ON public.markers
  FOR UPDATE
  USING (true);

-- 6. 모든 사용자(익명 포함) 삭제 정책
CREATE POLICY "모든 사용자 삭제 허용"
  ON public.markers
  FOR DELETE
  USING (true);

-- 7. 초기 기본 데이터 삽입 (선택 사항)
INSERT INTO public.markers (id, name, hanja, cat, period, "desc", x, y)
VALUES
  ('m1', '돈화문', '敦化門', '문', '태종 12년 (1412년, 1609년 재건)', '창덕궁의 정문으로 현재 남아있는 궁궐 정문 중 가장 오래된 목조 건물입니다. 보물 제383호로 지정되어 있습니다.', 15.2, 68.4),
  ('m2', '인정전', '仁政殿', '건물', '태종 5년 (1405년, 1804년 재건)', '창덕궁의 정전(正殿)으로 왕의 즉위식, 신하들의 하례, 외국 사신 접견 등 국가의 중대한 의식이 거행되던 공식 공간입니다. 국보 제225호입니다.', 22.4, 58.1),
  ('m3', '금천교', '錦川橋', '도로', '태종 11년 (1411년)', '돈화문과 진선문 사이 금천을 가로지르는 돌다리로, 서울에 현존하는 가장 오래된 궁궐 돌다리입니다.', 17.8, 65.2)
ON CONFLICT (id) DO NOTHING;
