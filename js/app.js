// ============================================================
// 동궐도 (東闕圖) 인터랙티브 아카이브 애플리케이션 로직
// ============================================================

// DOM 요소 참조
const viewer = document.getElementById('viewer');
const stage = document.getElementById('stage');
const mapImg = document.getElementById('mapImg');
const markersLayer = document.getElementById('markersLayer');
const tempPin = document.getElementById('tempPin');

// 툴바 & 컨트롤
const addModeBtn = document.getElementById('addModeBtn');
const cancelAddModeBtn = document.getElementById('cancelAddModeBtn');
const addModeBanner = document.getElementById('addModeBanner');
const openListBtn = document.getElementById('openListBtn');
const markerCountBadge = document.getElementById('markerCountBadge');

const dataMenuBtn = document.getElementById('dataMenuBtn');
const dataDropdown = document.getElementById('dataDropdown');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const importJsonInput = document.getElementById('importJsonInput');
const resetDataBtn = document.getElementById('resetDataBtn');

const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const zoomResetBtn = document.getElementById('zoomResetBtn');

// 상세 패널
const panel = document.getElementById('panel');
const panelClose = document.getElementById('panelClose');
const panelCategory = document.getElementById('panelCategory');
const panelName = document.getElementById('panelName');
const panelHanja = document.getElementById('panelHanja');
const panelPeriod = document.getElementById('panelPeriod');
const panelDesc = document.getElementById('panelDesc');
const editPlaceBtn = document.getElementById('editPlaceBtn');
const deletePlaceBtn = document.getElementById('deletePlaceBtn');

// 목록 드로어
const listDrawer = document.getElementById('listDrawer');
const listDrawerClose = document.getElementById('listDrawerClose');
const searchInput = document.getElementById('searchInput');
const filterChips = document.querySelectorAll('.chip');
const placeListContainer = document.getElementById('placeListContainer');

// 모달 다이얼로그
const placeModal = document.getElementById('placeModal');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const placeForm = document.getElementById('placeForm');
const modalTitle = document.getElementById('modalTitle');
const formId = document.getElementById('formId');
const formX = document.getElementById('formX');
const formY = document.getElementById('formY');
const formCat = document.getElementById('formCat');
const formName = document.getElementById('formName');
const formHanja = document.getElementById('formHanja');
const formPeriod = document.getElementById('formPeriod');
const formDesc = document.getElementById('formDesc');
const formCoordsDisplay = document.getElementById('formCoordsDisplay');

// 토스트
const toastEl = document.getElementById('toast');

// ============================================================
// 상태 관리 (State)
// ============================================================
let markers = [];
let isAddMode = false;
let selectedMarkerId = null;
let currentFilter = 'all';
let currentSearch = '';

// 뷰포트 상태 (줌 & 팬)
const MIN_SCALE = 0.25;
const MAX_SCALE = 6;
let view = { x: 0, y: 0, scale: 1 };

// ============================================================
// 데이터 로드 & 로컬스토리지 동기화
// ============================================================
async function loadMarkers() {
  // 1. Supabase 클라우드 DB에서 조회
  const remote = await dbFetchMarkers();

  // 최신 데이터(선정전 포함 4개)가 있는지 확인
  const hasModernData = remote && remote.some(m => m.id && m.id.startsWith('m_'));

  if (hasModernData) {
    markers = remote;
  } else {
    // DB에 옛날 3개만 있거나 비어있으면 -> 무조건 최신 4개(DEFAULT_MARKERS) 사용!
    markers = [...DEFAULT_MARKERS];

    // Supabase DB의 옛날 데이터를 정리하고 새 4개로 자동 동기화
    if (remote && remote.length > 0) {
      for (const oldM of remote) {
        if (oldM.id && !oldM.id.startsWith('m_')) {
          await dbDeleteMarker(oldM.id);
        }
      }
    }
    for (const newM of DEFAULT_MARKERS) {
      await dbInsertMarker(newM);
    }
  }

  saveMarkers();
  updateMarkerCount();
  renderMarkers();
}

function saveMarkers() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(markers));
    updateMarkerCount();
  } catch (err) {
    console.error('Failed to save markers:', err);
  }
}

function updateMarkerCount() {
  if (markerCountBadge) {
    markerCountBadge.textContent = `${markers.length}개 등록됨`;
  }
}

// ============================================================
// 토스트 메시지
// ============================================================
let toastTimer = null;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('show');
  }, 2600);
}

// ============================================================
// 지도 뷰어 (줌 / 팬 / 화면 맞춤)
// ============================================================
function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function applyTransform() {
  stage.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
}

function fitToScreen() {
  const vw = viewer.clientWidth, vh = viewer.clientHeight;
  const sw = stage.offsetWidth;
  const sh = (mapImg.naturalHeight / (mapImg.naturalWidth || 2200)) * sw;
  const scale = Math.min(vw / sw, vh / sh) * 0.94;
  view.scale = Math.max(MIN_SCALE, scale || 0.6);
  view.x = (vw - sw * view.scale) / 2;
  view.y = (vh - sh * view.scale) / 2;
  applyTransform();
}

mapImg.addEventListener('load', fitToScreen);
window.addEventListener('resize', fitToScreen);
if (mapImg.complete) {
  fitToScreen();
}

// 줌 컨트롤러 버튼
zoomInBtn.addEventListener('click', () => zoomByStep(1.25));
zoomOutBtn.addEventListener('click', () => zoomByStep(1 / 1.25));
zoomResetBtn.addEventListener('click', fitToScreen);

function zoomByStep(factor) {
  const cx = viewer.clientWidth / 2;
  const cy = viewer.clientHeight / 2;
  const newScale = clamp(view.scale * factor, MIN_SCALE, MAX_SCALE);
  const stageX = (cx - view.x) / view.scale;
  const stageY = (cy - view.y) / view.scale;
  view.x = cx - stageX * newScale;
  view.y = cy - stageY * newScale;
  view.scale = newScale;
  applyTransform();
}

// 마우스 휠 줌
viewer.addEventListener('wheel', (e) => {
  e.preventDefault();
  const rect = viewer.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
  const newScale = clamp(view.scale * factor, MIN_SCALE, MAX_SCALE);
  const stageX = (mx - view.x) / view.scale;
  const stageY = (my - view.y) / view.scale;
  view.x = mx - stageX * newScale;
  view.y = my - stageY * newScale;
  view.scale = newScale;
  applyTransform();
}, { passive: false });

// 드래그 팬 및 클릭 감지
let isPanning = false;
let pointerDownPos = { x: 0, y: 0 };
let startView = { x: 0, y: 0 };
const CLICK_THRESHOLD = 5; // 5px 미만 이동 시 클릭으로 판단

viewer.addEventListener('pointerdown', (e) => {
  if (e.target.closest('.marker') || e.target.closest('.zoom-controls') || e.target.closest('#header')) {
    return;
  }
  isPanning = true;
  pointerDownPos = { x: e.clientX, y: e.clientY };
  startView = { x: view.x, y: view.y };
  viewer.setPointerCapture(e.pointerId);
  if (!isAddMode) {
    viewer.classList.add('panning');
  }
});

viewer.addEventListener('pointermove', (e) => {
  if (!isPanning) return;
  view.x = startView.x + (e.clientX - pointerDownPos.x);
  view.y = startView.y + (e.clientY - pointerDownPos.y);
  applyTransform();
});

['pointerup', 'pointercancel'].forEach(evt => {
  viewer.addEventListener(evt, (e) => {
    if (!isPanning) return;
    isPanning = false;
    viewer.classList.remove('panning');

    const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
    // 드래그가 아닌 단순 클릭인 경우
    if (dist < CLICK_THRESHOLD) {
      handleViewerClick(e);
    }
  });
});

// 지도를 클릭했을 때의 처리
function handleViewerClick(e) {
  // 모달이나 패널 등이 열려 있는 상태에서 지도 클릭 시 닫기 처리
  if (dataDropdown.classList.contains('show')) {
    dataDropdown.classList.remove('show');
  }

  if (isAddMode) {
    // 스테이지 내 픽셀 좌표 계산
    const rect = viewer.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const stageX = (mx - view.x) / view.scale;
    const stageY = (my - view.y) / view.scale;

    const sw = stage.offsetWidth;
    const sh = mapImg.offsetHeight || ((mapImg.naturalHeight / (mapImg.naturalWidth || 2200)) * sw);

    // % 좌표로 변환 (소수점 1자리)
    const pctX = Math.round(((stageX / sw) * 100) * 10) / 10;
    const pctY = Math.round(((stageY / sh) * 100) * 10) / 10;

    if (pctX >= 0 && pctX <= 100 && pctY >= 0 && pctY <= 100) {
      // 등록 모달 열기
      openAddModal(pctX, pctY);
    } else {
      showToast('지도 이미지 영역 안쪽을 클릭해주세요.');
    }
  } else {
    // 추가 모드가 아닐 때 빈 곳 클릭 시 패널 닫기
    if (!e.target.closest('#panel') && !e.target.closest('#listDrawer')) {
      closePanel();
    }
  }
}

// ============================================================
// 추가 모드 (Add Mode) 제어
// ============================================================
function setAddMode(enabled) {
  isAddMode = enabled;
  if (enabled) {
    addModeBtn.classList.add('active');
    addModeBanner.classList.add('show');
    viewer.classList.add('add-mode');
    closePanel();
    closeListDrawer();
    showToast('등록할 건물의 위치를 지도에서 클릭하세요.');
  } else {
    addModeBtn.classList.remove('active');
    addModeBanner.classList.remove('show');
    viewer.classList.remove('add-mode');
    tempPin.style.display = 'none';
  }
}

addModeBtn.addEventListener('click', () => {
  setAddMode(!isAddMode);
});
cancelAddModeBtn.addEventListener('click', () => {
  setAddMode(false);
});

// ============================================================
// 마커 렌더링 & 인터랙션
// ============================================================
function getCategoryIcon(cat) {
  switch (cat) {
    case '건물': return '🏯';
    case '문': return '⛩️';
    case '도로': return '🛤️';
    default: return '🌲';
  }
}

function renderMarkers() {
  markersLayer.innerHTML = '';

  markers.forEach(m => {
    const el = document.createElement('div');
    el.className = `marker cat-${m.cat || '건물'} ${selectedMarkerId === m.id ? 'active' : ''}`;
    el.style.left = `${m.x}%`;
    el.style.top = `${m.y}%`;
    el.dataset.id = m.id;

    el.innerHTML = `
      <div class="marker-pin">
        <span class="marker-icon">${getCategoryIcon(m.cat)}</span>
      </div>
      <div class="marker-label">${m.name}</div>
    `;

    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation(); // 팬 동작 방지
    });

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      selectMarker(m);
    });

    markersLayer.appendChild(el);
  });

  renderPlaceList();
}

function selectMarker(m, focusMap = false) {
  selectedMarkerId = m.id;
  setAddMode(false);

  // 마커 active 클래스 갱신
  document.querySelectorAll('.marker').forEach(el => {
    el.classList.toggle('active', el.dataset.id === m.id);
  });

  // 상세 패널 오픈
  openPanel(m);

  // 지도 이동 (포커스 요청 시)
  if (focusMap) {
    focusOnMarker(m);
  }
}

function focusOnMarker(m) {
  const sw = stage.offsetWidth;
  const sh = mapImg.offsetHeight || ((mapImg.naturalHeight / (mapImg.naturalWidth || 2200)) * sw);
  const targetX = (m.x / 100) * sw;
  const targetY = (m.y / 100) * sh;

  // 타겟 스케일 (최소 1.8 이상으로 확대)
  const targetScale = Math.max(view.scale, 1.8);
  const vw = viewer.clientWidth;
  const vh = viewer.clientHeight;

  // 패널이 열리므로 중앙보다 약간 왼쪽에 위치하도록 보정
  const cx = vw * 0.45;
  const cy = vh * 0.5;

  view.scale = targetScale;
  view.x = cx - targetX * targetScale;
  view.y = cy - targetY * targetScale;
  applyTransform();
}

// ============================================================
// 상세 정보 사이드 패널
// ============================================================
function openPanel(m) {
  panelCategory.textContent = m.cat || '건물';
  panelCategory.className = `badge badge-${m.cat || '건물'}`;
  panelName.textContent = m.name;
  panelHanja.textContent = m.hanja ? `(${m.hanja})` : '';
  panelPeriod.textContent = m.period || '시기 미상';
  panelDesc.textContent = m.desc || '등록된 상세 설명이 없습니다.';

  panel.classList.add('open');
}

function closePanel() {
  panel.classList.remove('open');
  selectedMarkerId = null;
  document.querySelectorAll('.marker.active').forEach(el => el.classList.remove('active'));
}

panelClose.addEventListener('click', closePanel);

editPlaceBtn.addEventListener('click', () => {
  const m = markers.find(item => item.id === selectedMarkerId);
  if (m) {
    openEditModal(m);
  }
});

deletePlaceBtn.addEventListener('click', () => {
  const m = markers.find(item => item.id === selectedMarkerId);
  if (!m) return;
  if (confirm(`'${m.name}' 장소를 정말 삭제하시겠습니까?`)) {
    markers = markers.filter(item => item.id !== selectedMarkerId);
    dbDeleteMarker(selectedMarkerId);
    saveMarkers();
    closePanel();
    renderMarkers();
    showToast(`'${m.name}'이(가) 삭제되었습니다.`);
  }
});

// ============================================================
// 모달 (등록 / 수정)
// ============================================================
function openAddModal(pctX, pctY) {
  modalTitle.textContent = '새 장소 등록';
  formId.value = '';
  formX.value = pctX;
  formY.value = pctY;
  formCat.value = '건물';
  formName.value = '';
  formHanja.value = '';
  formPeriod.value = '';
  formDesc.value = '';
  formCoordsDisplay.textContent = `등록 위치: 가로 ${pctX}%, 세로 ${pctY}%`;

  // 임시 핀 위치 표시
  tempPin.style.left = `${pctX}%`;
  tempPin.style.top = `${pctY}%`;
  tempPin.style.display = 'block';

  placeModal.style.display = 'flex';
  setTimeout(() => formName.focus(), 60);
}

function openEditModal(m) {
  modalTitle.textContent = '장소 정보 수정';
  formId.value = m.id;
  formX.value = m.x;
  formY.value = m.y;
  formCat.value = m.cat || '건물';
  formName.value = m.name || '';
  formHanja.value = m.hanja || '';
  formPeriod.value = m.period || '';
  formDesc.value = m.desc || '';
  formCoordsDisplay.textContent = `위치: 가로 ${m.x}%, 세로 ${m.y}%`;

  placeModal.style.display = 'flex';
  setTimeout(() => formName.focus(), 60);
}

function closeModal() {
  placeModal.style.display = 'none';
  tempPin.style.display = 'none';
  setAddMode(false);
}

modalCloseBtn.addEventListener('click', closeModal);
modalCancelBtn.addEventListener('click', closeModal);
placeModal.addEventListener('click', (e) => {
  if (e.target === placeModal) closeModal();
});

placeForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const id = formId.value.trim();
  const name = formName.value.trim();
  const hanja = formHanja.value.trim();
  const cat = formCat.value;
  const period = formPeriod.value.trim();
  const desc = formDesc.value.trim();
  const x = parseFloat(formX.value);
  const y = parseFloat(formY.value);

  if (!name) {
    alert('이름을 입력해주세요.');
    return;
  }

  if (id) {
    // 수정 처리
    const idx = markers.findIndex(m => m.id === id);
    if (idx !== -1) {
      markers[idx] = { ...markers[idx], name, hanja, cat, period, desc, x, y };
      dbUpdateMarker(markers[idx]);
      saveMarkers();
      showToast(`'${name}' 정보가 수정되었습니다.`);
      selectMarker(markers[idx]);
    }
  } else {
    // 신규 등록 처리
    const newPlace = {
      id: 'm_' + Date.now(),
      name,
      hanja,
      cat,
      period,
      desc,
      x,
      y
    };
    markers.push(newPlace);
    dbInsertMarker(newPlace);
    saveMarkers();
    showToast(`새로운 장소 '${name}'이(가) 등록되었습니다!`);
    selectMarker(newPlace);
  }

  closeModal();
  renderMarkers();
});

// ============================================================
// 목록 탐색기 사이드 드로어
// ============================================================
function openListDrawer() {
  listDrawer.classList.add('open');
  renderPlaceList();
}
function closeListDrawer() {
  listDrawer.classList.remove('open');
}

openListBtn.addEventListener('click', openListDrawer);
listDrawerClose.addEventListener('click', closeListDrawer);

// 필터 칩 이벤트
filterChips.forEach(chip => {
  chip.addEventListener('click', () => {
    filterChips.forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    currentFilter = chip.dataset.filter;
    renderPlaceList();
  });
});

searchInput.addEventListener('input', (e) => {
  currentSearch = e.target.value.toLowerCase().trim();
  renderPlaceList();
});

function renderPlaceList() {
  placeListContainer.innerHTML = '';

  const filtered = markers.filter(m => {
    const matchCat = currentFilter === 'all' || m.cat === currentFilter;
    const matchQuery = !currentSearch ||
      (m.name && m.name.toLowerCase().includes(currentSearch)) ||
      (m.hanja && m.hanja.toLowerCase().includes(currentSearch)) ||
      (m.period && m.period.toLowerCase().includes(currentSearch)) ||
      (m.desc && m.desc.toLowerCase().includes(currentSearch));
    return matchCat && matchQuery;
  });

  if (filtered.length === 0) {
    placeListContainer.innerHTML = `
      <li style="padding: 24px 12px; text-align: center; color: #94a3b8; font-size: 0.85rem;">
        검색 결과가 없습니다.
      </li>
    `;
    return;
  }

  filtered.forEach(m => {
    const li = document.createElement('li');
    li.className = 'place-item';
    li.innerHTML = `
      <div class="place-item-top">
        <div>
          <span class="place-item-title">${m.name}</span>
          ${m.hanja ? `<span class="place-item-hanja">${m.hanja}</span>` : ''}
        </div>
        <span class="badge badge-${m.cat || '건물'}">${m.cat || '건물'}</span>
      </div>
      <div class="place-item-period">🕒 ${m.period || '시기 미상'}</div>
    `;

    li.addEventListener('click', () => {
      selectMarker(m, true);
      if (window.innerWidth <= 768) {
        closeListDrawer();
      }
    });

    placeListContainer.appendChild(li);
  });
}

// ============================================================
// 데이터 관리 (JSON Export / Import / Reset)
// ============================================================
dataMenuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  dataDropdown.classList.toggle('show');
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.dropdown')) {
    dataDropdown.classList.remove('show');
  }
});

// JSON 내보내기 (다운로드)
exportJsonBtn.addEventListener('click', () => {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(markers, null, 2));
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute('href', dataStr);
  dlAnchor.setAttribute('download', `donggwoldo_markers_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(dlAnchor);
  dlAnchor.click();
  dlAnchor.remove();
  dataDropdown.classList.remove('show');
  showToast('마커 데이터가 JSON 파일로 다운로드되었습니다.');
});

// JSON 가져오기 (불러오기)
importJsonInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const imported = JSON.parse(event.target.result);
      if (Array.isArray(imported)) {
        markers = imported;
        saveMarkers();
        renderMarkers();
        showToast(`${imported.length}개의 마커 데이터를 복원했습니다.`);
      } else {
        alert('올바른 마커 데이터 형식이 아닙니다.');
      }
    } catch (err) {
      alert('JSON 파일을 파싱하는 데 실패했습니다: ' + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
  dataDropdown.classList.remove('show');
});

// 초기화
resetDataBtn.addEventListener('click', () => {
  if (confirm('모든 사용자 데이터를 삭제하고 기본 데이터로 초기화하시겠습니까?')) {
    markers = [...DEFAULT_MARKERS];
    saveMarkers();
    closePanel();
    renderMarkers();
    dataDropdown.classList.remove('show');
    showToast('기본 데이터로 초기화되었습니다.');
  }
});

// ============================================================
// 키보드 단축키
// ============================================================
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (placeModal.style.display !== 'none') {
      closeModal();
    } else if (isAddMode) {
      setAddMode(false);
    } else if (panel.classList.contains('open')) {
      closePanel();
    } else if (listDrawer.classList.contains('open')) {
      closeListDrawer();
    }
  }
});

// ============================================================
// 초기화 실행
// ============================================================
loadMarkers();
renderMarkers();

// 안내 모달 이벤트
const openInfoBtn = document.getElementById('openInfoBtn');
const infoModal = document.getElementById('infoModal');
const infoModalCloseBtn = document.getElementById('infoModalCloseBtn');
const infoModalConfirmBtn = document.getElementById('infoModalConfirmBtn');

function openInfoModal() { if (infoModal) infoModal.style.display = 'flex'; }
function closeInfoModal() { if (infoModal) infoModal.style.display = 'none'; }

if (openInfoBtn) openInfoBtn.addEventListener('click', openInfoModal);
if (infoModalCloseBtn) infoModalCloseBtn.addEventListener('click', closeInfoModal);
if (infoModalConfirmBtn) infoModalConfirmBtn.addEventListener('click', closeInfoModal);
if (infoModal) infoModal.addEventListener('click', (e) => { if (e.target === infoModal) closeInfoModal(); });
