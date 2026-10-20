// ============================================================
// Supabase 클라이언트 설정 및 연동 모듈
// ============================================================

const SUPABASE_URL = 'https://vldsqbfpfjrwcygpyyxd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_j2Gt4NqdK6q1T2Q4A8cjQQ_slsCr6qM';

let supabaseClient = null;

function getSupabase() {
  if (!supabaseClient && window.supabase) {
    try {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log('[Supabase] Client initialized successfully');
    } catch (e) {
      console.error('[Supabase] Init failed:', e);
    }
  }
  return supabaseClient;
}

// 전체 마커 조회 (실패 시 null 반환하여 로컬 fallback 사용)
async function dbFetchMarkers() {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('markers')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('[Supabase] fetchMarkers error:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('[Supabase] fetchMarkers network exception:', err);
    return null;
  }
}

// 새 마커 추가
async function dbInsertMarker(marker) {
  const client = getSupabase();
  if (!client) return false;
  try {
    const { error } = await client
      .from('markers')
      .insert([
        {
          id: marker.id,
          name: marker.name,
          hanja: marker.hanja || '',
          cat: marker.cat || '건물',
          period: marker.period || '',
          desc: marker.desc || '',
          x: marker.x,
          y: marker.y
        }
      ]);
    if (error) {
      console.error('[Supabase] insertMarker error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase] insertMarker exception:', err);
    return false;
  }
}

// 마커 수정
async function dbUpdateMarker(marker) {
  const client = getSupabase();
  if (!client) return false;
  try {
    const { error } = await client
      .from('markers')
      .update({
        name: marker.name,
        hanja: marker.hanja || '',
        cat: marker.cat || '건물',
        period: marker.period || '',
        desc: marker.desc || '',
        x: marker.x,
        y: marker.y
      })
      .eq('id', marker.id);

    if (error) {
      console.error('[Supabase] updateMarker error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase] updateMarker exception:', err);
    return false;
  }
}

// 마커 삭제
async function dbDeleteMarker(markerId) {
  const client = getSupabase();
  if (!client) return false;
  try {
    const { error } = await client
      .from('markers')
      .delete()
      .eq('id', markerId);

    if (error) {
      console.error('[Supabase] deleteMarker error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase] deleteMarker exception:', err);
    return false;
  }
}

// 로컬 마커 데이터를 Supabase DB에 일괄 동기화 (Upsert)
async function dbSyncAllMarkers(localMarkers) {
  const client = getSupabase();
  if (!client) return { success: false, message: 'Supabase 클라이언트를 초기화할 수 없습니다.' };
  try {
    const records = localMarkers.map(m => ({
      id: m.id,
      name: m.name,
      hanja: m.hanja || '',
      cat: m.cat || '건물',
      period: m.period || '',
      desc: m.desc || '',
      x: m.x,
      y: m.y
    }));

    const { error } = await client
      .from('markers')
      .upsert(records, { onConflict: 'id' });

    if (error) {
      console.error('[Supabase] upsert error:', error);
      return { success: false, message: error.message };
    }
    return { success: true, count: records.length };
  } catch (err) {
    console.error('[Supabase] upsert exception:', err);
    return { success: false, message: err.message };
  }
}
