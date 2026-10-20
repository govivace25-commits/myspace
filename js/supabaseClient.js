// js/supabaseClient.js
const SUPABASE_URL = 'https://vldsqbfpfjrwcygpyyxd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_j2Gt4NqdK6q1T2Q4A8cjQQ_slsCr6qM';

let supabaseClient = null;

function getSupabase() {
  if (!supabaseClient && window.supabase) {
    try {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (e) {
      console.error('[Supabase] Init error:', e);
    }
  }
  return supabaseClient;
}

// 1. 전체 마커 불러오기
async function dbFetchMarkers() {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await client.from('markers').select('*').order('created_at', { ascending: true });
    return error ? null : data;
  } catch (err) {
    return null;
  }
}

// 2. 마커 추가
async function dbInsertMarker(marker) {
  const client = getSupabase();
  if (!client) return false;
  try {
    const { error } = await client.from('markers').insert([{
      id: marker.id,
      name: marker.name,
      hanja: marker.hanja || '',
      cat: marker.cat || '건물',
      period: marker.period || '',
      desc: marker.desc || '',
      x: marker.x,
      y: marker.y
    }]);
    return !error;
  } catch (err) {
    return false;
  }
}

// 3. 마커 수정
async function dbUpdateMarker(marker) {
  const client = getSupabase();
  if (!client) return false;
  try {
    const { error } = await client.from('markers').update({
      name: marker.name,
      hanja: marker.hanja || '',
      cat: marker.cat || '건물',
      period: marker.period || '',
      desc: marker.desc || '',
      x: marker.x,
      y: marker.y
    }).eq('id', marker.id);
    return !error;
  } catch (err) {
    return false;
  }
}

// 4. 마커 삭제
async function dbDeleteMarker(markerId) {
  const client = getSupabase();
  if (!client) return false;
  try {
    const { error } = await client.from('markers').delete().eq('id', markerId);
    return !error;
  } catch (err) {
    return false;
  }
}
