// ui_v405.js (IMPROVED: AUTO pause/resume + clearer button UI)
// Generated from guno_V4_051.html (v4.05) for V5 split

let winnerIdx = undefined;

// ===== AUTO 一時停止フラグ =====
let autoPaused = false;   // true = AUTOモードだが一時停止中

// 翻訳ヘルパー関数（v4互換）
const t = (ja, en) => isJapanese ? ja : en;

function log(m) { const l = document.getElementById('log'); l.innerHTML += '<div>' + m + '</div>'; l.scrollTop = l.scrollHeight; }

/** 効果音再生（クローン再生で連打対応） */
function playSE(id, vol=1.0){
  const a = document.getElementById(id);
  if(!a) return;
  const b = a.cloneNode(true);
  b.volume = vol;
  b.play().catch(()=>{});
}

/** 自動再生制限解除 */
let seUnlocked = false;
function unlockSE(){
  if(seUnlocked) return;
  seUnlocked = true;
  ["sePlay","seDraw","seBlackout","seGuno"].forEach(id=>{
    const a = document.getElementById(id);
    if(!a) return;
    a.volume = 0;
    a.play().then(()=>{ a.pause(); a.currentTime=0; a.volume=1; }).catch(()=>{});
  });
}
document.addEventListener("pointerdown", unlockSE, { once:true });

function startGame() {

    // ★ 勝者リセット
    winnerIdx = undefined;

    clearPersistentResult();
    hideResultLinesOnMainMap();

    if(autoTimer) clearTimeout(autoTimer);

    gameOver = false;
    turnCount = 0;
    turnIndex = 0;
    direction = 1;
    isWaitingHuman = false;
    mapState = {};
    lastHits = {};
    consecutivePasses = 0;
    autoPaused = false;   // ★ 一時停止リセット

    teidenPlayed = { JY:false, M:false, G:false, T:false };

    deck = [];
    STATIONS_DB.forEach(s => {
        for(let i=0; i<2; i++)
            deck.push({...s, type:'station', id:'s-' + s.lc + '-' + s.order + '-' + i});
    });

    ['JY','M','G','T'].forEach(lc =>
        deck.push({lc, type:'teiden', file:TEIDEN_FILES[lc], id:'t-' + lc, color:'#000'})
    );

    deck.sort(() => Math.random() - 0.5);

    players = [
        { name: "P1", isHuman: !autoPlay, hand: [], color: '#174a7c', icon: '🌊', status: 'active', guno: 0 },
        { name: "P2", isHuman: false, hand: [], color: '#b52942', icon: '🌸', status: 'active', guno: 0 },
        { name: "P3", isHuman: false, hand: [], color: '#e6b422', icon: '🌙', status: 'active', guno: 0 },
        { name: "P4", isHuman: false, hand: [], color: '#745399', icon: '🏯', status: 'active', guno: 0 }
    ];

    players.forEach(p => {
        for(let i=0; i<7; i++)
            p.hand.push(deck.pop());
    });

    discardPile = [];
    while(true) {
        let c = deck.pop();
        discardPile.push(c);
        if(c.type==='station'){
            mapState[c.lc + "-" + c.order]=-1;
            break;
        }
    }

    document.getElementById('log').innerHTML = "";
    document.getElementById('result-overlay').style.display = 'none';

    updateModeButton();
    nextTurn();

    if (typeof showNetworkLinesOnMainMap === "function") {
        showNetworkLinesOnMainMap("game");
    }
}

function nextTurn() {
    if(gameOver) return;
    // ★ 一時停止中はCPUターンを進めない
    if(autoPaused) return;

    const activePlayers = players.filter(p => p.status === 'active');
    if(activePlayers.length <= 1){ 
        log(t('🏁 ゲーム終了！ 残りプレーヤー: ', '🏁 Game Over! Remaining players: ') + activePlayers.length + t('人', ''));
        endGame(); 
        return; 
    }
    // 無限ループ防止：全員が出せるカードがない場合
    if(consecutivePasses >= activePlayers.length * 2){
        log(t('🏁 ゲーム終了！ 誰もプレイできるカードがありません', '🏁 Game Over! No playable cards'));
        endGame();
        return;
    }
    renderAll();
    const p = players[turnIndex]; 
    if(p.status !== 'active') { advanceTurn(); nextTurn(); return; }
    const pi = getPlayableIndices(p);
    if(pi.length === 0 && deck.length === 0){
        consecutivePasses++;
        console.log('[DEBUG] ' + p.name + ' パス (consecutivePasses=' + consecutivePasses + ')');
        advanceTurn(); setTimeout(nextTurn, 500); return;
    }
    if(p.isHuman && !autoPlay) { isWaitingHuman = true; renderAll(); } 
    else { isWaitingHuman = false; autoTimer = setTimeout(playCPUTurn, 500); }
}

function executePlay(pIdx, cardIdx) {
    const p = players[pIdx], card = p.hand.splice(cardIdx, 1)[0], top = discardPile[discardPile.length - 1];
    discardPile.push(card);
    consecutivePasses = 0; // カードがプレイされたのでリセット
    
    // 効果音：停電カードか通常カードか
    if(card.type === 'teiden') {
        playSE('seBlackout', 1.0);
    } else {
        playSE('sePlay', 0.8);
    }
    
    if(card.type === 'station') {
        const key = card.lc + "-" + card.order, prev = mapState[key];
        if(prev !== undefined && prev !== -1 && prev !== pIdx) log(t('⚔️ <b>' + players[prev].name + '</b>から奪取！', '⚔️ Captured from <b>' + players[prev].name + '</b>!'));
        mapState[key] = pIdx;
        if(top.type === 'station' && card.st_ja.replace('★','') === top.st_ja.replace('★','')) { direction *= -1; log("🔄 REVERSE!"); }
        checkGuno(card.lc, pIdx);
    } else {
        teidenPlayed[card.lc] = true; direction *= -1; log(t("⚡ 停電！逆転！", "⚡ Blackout! Reverse!"));
        players.forEach((o, i) => { if(i!==pIdx && o.status==='active' && deck.length) { o.hand.push(deck.pop()); playSE('seDraw', 0.6); log(t('🎴 <b>' + o.name + '</b> がカードを引きました', '🎴 <b>' + o.name + '</b> drew a card')); } });
        checkGuno(card.lc, pIdx);
    }
    log('[' + p.icon + p.name + '] ' + card.lc + ' ' + (isJapanese ? (card.st_ja||'⚡') : (card.st_en||'⚡')));
    if(p.hand.length === 0) {
        p.status = 'eliminated';
        log(t('❌ <b>' + p.name + '</b> が脱落しました（手条0）', '❌ <b>' + p.name + '</b> eliminated (0 cards)'));
    }
    const activeCount = players.filter(x=>x.status==='active').length;
    if(activeCount <= 1) {
        log(t('🏁 ゲーム終了！ 残りプレーヤー: ', '🏁 Game Over! Remaining players: ') + activeCount + t('人', ''));
        endGame();
    }
}

function animateDeckDraw() {
    const deckEl = document.getElementById('draw-pile-visual');
    if (!deckEl) return;
    // DECKカードのポップアニメーション
    deckEl.classList.add('deck-draw-anim');
    setTimeout(() => deckEl.classList.remove('deck-draw-anim'), 380);
    // カードが手札エリアに飛んでいくアニメーション
    const deckRect = deckEl.getBoundingClientRect();
    const handEl = document.querySelector('#players-area .player-box') || document.querySelector('.player-box');
    if (!handEl) return;
    const handRect = handEl.getBoundingClientRect();
    const fly = document.createElement('div');
    fly.className = 'card-fly';
    fly.style.cssText = `
        left: ${deckRect.left}px;
        top: ${deckRect.top}px;
        width: ${deckRect.width}px;
        height: ${deckRect.height}px;
        transform: scale(1) rotate(0deg);
        opacity: 1;
    `;
    document.body.appendChild(fly);
    const dx = (handRect.left + handRect.width / 2) - (deckRect.left + deckRect.width / 2);
    const dy = (handRect.top + handRect.height / 2) - (deckRect.top + deckRect.height / 2);
    requestAnimationFrame(() => {
        fly.style.transition = 'transform 0.38s cubic-bezier(0.22,1,0.36,1), opacity 0.38s ease';
        fly.style.transform = `translate(${dx}px, ${dy}px) scale(0.7) rotate(${Math.random()*20-10}deg)`;
        fly.style.opacity = '0';
    });
    setTimeout(() => fly.remove(), 420);
}

function humanDraw() { 
    if(!isWaitingHuman || turnIndex !== 0 || getPlayableIndices(players[0]).length > 0 || !deck.length) return;
    animateDeckDraw();
    players[0].hand.push(deck.pop()); 
    playSE('seDraw', 0.6);
    log(t('🎴 <b>' + players[0].name + '</b> がカードを引きました', '🎴 <b>' + players[0].name + '</b> drew a card'));
    renderAll();
    const playable = getPlayableIndices(players[0]);
    if(playable.length > 0) {
        return;
    }
    isWaitingHuman = false; 
    advanceTurn(); 
    nextTurn(); 
}
function humanPlay(idx) { if(!isWaitingHuman || turnIndex !== 0 || !getPlayableIndices(players[0]).includes(idx)) return; isWaitingHuman = false; executePlay(0, idx); advanceTurn(); nextTurn(); }

function playCPUTurn() { 
    if(autoPaused) return;  // ★ 一時停止中はCPUターンをスキップ
    const p = players[turnIndex];
    let pi = getPlayableIndices(p); 
    if(pi.length) {
        executePlay(turnIndex, pi[0]); 
    } else if(deck.length) {
        p.hand.push(deck.pop()); 
        playSE('seDraw', 0.6);
        log(t('🎴 <b>' + p.name + '</b> がカードを引きました', '🎴 <b>' + p.name + '</b> drew a card'));
        pi = getPlayableIndices(p);
        if(pi.length) {
            executePlay(turnIndex, pi[0]);
        }
    } else {
        advanceTurn(); 
        nextTurn(); 
        return; 
    }
    advanceTurn(); 
    nextTurn(); 
}

function getPlayableIndices(p) {
    if (!discardPile.length) return [];
    const top = discardPile[discardPile.length - 1];
    return p.hand.map((c, i) => {
        if(c.type === 'teiden') return (p.hand.length > 1 && (top.type === 'teiden' || c.lc === top.lc)) ? i : -1;
        const norm = s => (s||"").replace('★','');
        if(c.lc === top.lc || norm(c.st_ja) === norm(top.st_ja) || (top.type==='station' && c.order === top.order)) return i;
        return -1;
    }).filter(i => i !== -1);
}

function checkGuno(lc, pIdx){
    let filledCount = 0;
    for(let i=1; i<=10; i++) {
        const owner = mapState[lc + "-" + i];
        if(owner !== undefined && owner !== -1) {
            filledCount++;
        }
    }
    console.log('[DEBUG] ' + players[pIdx].name + ' ' + lc + ' プレイ | 埋まった駅: ' + filledCount + '/10 | lastHits[' + lc + ']=' + (lastHits[lc] !== undefined ? players[lastHits[lc]].name : 'none'));
    
    if (filledCount === 10 && lastHits[lc] === undefined){ 
        lastHits[lc] = pIdx; 
        players[pIdx].guno++; 
        console.log('[GUNO!] ' + players[pIdx].name + ' が ' + lc + ' を完成！（10駅すべて埋まった）');
        log(t('🎆 <b>' + players[pIdx].name + '</b> が ' + lc + ' を完成！(GUNO達成)', '🎆 <b>' + players[pIdx].name + '</b> completed ' + lc + '! (GUNO)'));
        playSE('seGuno', 1.0);
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } }); 
        const totalGuno = players.reduce((sum, p) => sum + p.guno, 0);
        if(totalGuno >= 4) endGame(); 
    }
}

function endGame() {
  gameOver = true;
  autoPaused = false;   // ★ 終了時は一時停止フラグをリセット
  if(autoTimer) clearTimeout(autoTimer);

  renderAll();
  updateModeButton();   // ★ ゲーム終了後のボタン状態を更新

  // ランキング計算・スロット演出（winner-glow）を先に適用
  const ranking = showRanking();
  winnerIdx = players.indexOf(ranking[0].p);
  renderAll();
  renderPersistentResult(ranking);

  if (typeof showNetworkLinesOnMainMap === "function") {
    showNetworkLinesOnMainMap("result");
  } else {
    showResultLinesOnMainMap();
  }

  playSE('seEnd', 1.0);

  // ===== トースト通知を表示（オーバーレイは廃止）=====
  _showVictoryToast();
}

function getOwnedStationsByPlayer(pIdx){
  const db = (window.STATIONS_DB || (typeof STATIONS_DB !== "undefined" ? STATIONS_DB : []));
  return db.filter(st => {
    const key = `${st.lc}-${st.order}`;
    return mapState[key] === pIdx;
  });
}

// トースト通知を画面上部に表示（4秒後に自動消滅）
function _showVictoryToast() {
  const winnerName = players[winnerIdx] ? (players[winnerIdx].name || `P${winnerIdx+1}`) : '???';
  const winnerIcon = players[winnerIdx] ? (players[winnerIdx].icon || '🏆') : '🏆';

  // 既存のトーストがあれば削除
  const old = document.getElementById('victory-toast');
  if (old) old.remove();

  const toast = document.createElement('div');
  toast.id = 'victory-toast';
  toast.innerHTML = `🏆 ${winnerIcon} <strong>${winnerName} WIN!</strong> &nbsp;<span style="font-size:0.75em;opacity:.85;">← 左メニューで結果を確認</span>`;
  toast.style.cssText = [
    'position:fixed',
    'top:12px',
    'left:50%',
    'transform:translateX(-50%)',
    'background:linear-gradient(135deg,#1a1a1a 60%,#2a1f00)',
    'color:gold',
    'font-size:clamp(14px,3.5vw,20px)',
    'font-weight:bold',
    'padding:10px 22px',
    'border-radius:30px',
    'border:2px solid gold',
    'box-shadow:0 0 24px rgba(255,215,0,0.6),0 4px 16px rgba(0,0,0,0.7)',
    'z-index:9500',
    'white-space:nowrap',
    'pointer-events:none',
    'opacity:0',
    'transition:opacity 0.4s ease',
  ].join(';');
  document.body.appendChild(toast);

  // フェードイン
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { toast.style.opacity = '1'; });
  });

  // 紙吹雪
  if (window.confetti) window.confetti({ particleCount: 200, spread: 100 });

  // 4秒後にフェードアウト→削除
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 500);
  }, 4000);
}

function showRanking() {
  const data = players.map((p, idx) => {
    const ownedStations = getOwnedStationsByPlayer(idx);
    const stCount = ownedStations.length;

    const gunoPts = p.guno * GUNO_POINT;
    const base = gunoPts + stCount;

    const connPts = calcConnectionBonus(ownedStations);
    const total = base + connPts;

    const isAlive = p.status !== 'eliminated';

    return { p, stCount, gunoPts, base, connPts, total, isAlive, ownedStations };
  });

  const ranking = data.sort((a,b) => {
    if (a.isAlive !== b.isAlive) return b.isAlive - a.isAlive;
    return b.total - a.total;
  });

  let rows = "";
  ranking.forEach((r, i) => {
    const isFirst = (i === 0);
    const style = isFirst
      ? 'style="color:gold; font-weight:bold; background:rgba(255,215,0,0.12);"'
      : "";
    rows +=
      '<tr ' + style + '>' +
        '<td>' + (isFirst ? '🏆 ' : '') + (i+1) + '</td>' +
        '<td>' + r.p.icon + ' ' + r.p.name + '</td>' +
        '<td>' + r.total + '</td>' +
        '<td>' + r.base + '</td>' +
        '<td>+' + r.connPts + '</td>' +
        '<td>' + r.stCount + '</td>' +
        '<td>' + r.p.guno + '</td>' +
      '</tr>';
  });

  document.getElementById('result-table').innerHTML =
    '<thead><tr>' +
      '<th>' + t('順位', 'Rank') + '</th>' +
      '<th>Player</th>' +
      '<th>Total</th>' +
      '<th>Base</th>' +
      '<th>Conn</th>' +
      '<th>Stations</th>' +
      '<th>GUNO</th>' +
    '</tr></thead><tbody>' + rows + '</tbody>';

  renderStationBreakdown(ranking);

  return ranking;
}

function renderStationBreakdown(ranking){
  let box = document.getElementById('result-stations');
  if(!box){
    box = document.createElement('div');
    box.id = 'result-stations';
    box.style.marginTop = '12px';
    box.style.maxHeight = '240px';
    box.style.overflow = 'auto';
    box.style.padding = '10px';
    box.style.background = 'rgba(0,0,0,0.35)';
    box.style.borderRadius = '12px';
    document.getElementById('result-table').parentElement.appendChild(box);
  }

  const html = ranking.map(r => {
    const list = [...(r.ownedStations || [])]
      .sort((a,b) => (b.degree_real||1) - (a.degree_real||1))
      .map(s => `${s.st_ja}（${s.degree_real||1}）`)
      .join(' / ');

    return `
      <div style="margin-bottom:10px;">
        <div style="font-weight:bold;">${r.p.icon} ${r.p.name}</div>
        <div style="opacity:.9; font-size:12px;">${list || '(none)'}</div>
      </div>
    `;
  }).join('');

  box.innerHTML = html;
}

// ===== AUTO制御（改良版） =====

/**
 * AUTOモードのON/OFFを切り替える
 * OFF→ON: AUTOモードを開始（P1もCPU化）
 * ON→OFF: AUTOモードを終了（P1を人間に戻す）
 */
function toggleAuto() {
    autoPlay = !autoPlay;
    players[0].isHuman = !autoPlay;
    autoPaused = false;   // AUTO切替時は一時停止解除
    if (autoTimer) clearTimeout(autoTimer);
    updateModeButton();
    if(!gameOver) {
        isWaitingHuman = (turnIndex===0 && !autoPlay);
        renderAll();
        if(autoPlay) nextTurn();
    }
}

/**
 * AUTOモード中の一時停止・再開
 * 停止: タイマーをクリアし、autoPaused=true
 * 再開: autoPaused=false にして nextTurn() を呼ぶ
 */
function togglePause() {
    if(!autoPlay || gameOver) return;
    autoPaused = !autoPaused;
    if(autoPaused) {
        // 停止
        if(autoTimer) clearTimeout(autoTimer);
        log(t('⏸ AUTO一時停止', '⏸ AUTO Paused'));
    } else {
        // 再開
        log(t('▶ AUTO再開', '▶ AUTO Resumed'));
        nextTurn();
    }
    updateModeButton();
    renderAll();
}

/**
 * ボタン表示を状態に合わせて更新
 *
 * 状態パターン：
 *   gameOver           → 新規ボタンのみ強調、AUTOボタンはグレー
 *   !autoPlay          → AUTO: OFF（グレー）
 *   autoPlay && !paused → AUTO: ON（緑）+ ⏸ 停止ボタン表示
 *   autoPlay && paused  → AUTO: 停止中（オレンジ）+ ▶ 再開ボタン表示
 */
function updateModeButton() {
    const btnMode   = document.getElementById('btn-mode');
    const btnPause  = document.getElementById('btn-pause');
    const btnNew    = document.getElementById('btn-new');

    if(!btnMode) return;

    if(gameOver) {
        // ゲーム終了後
        btnMode.textContent = t('AUTO: OFF', 'AUTO: OFF');
        btnMode.className = 'btn-auto-off';
        btnMode.disabled = false;
        if(btnPause) { btnPause.style.display = 'none'; }
        if(btnNew) { btnNew.classList.add('btn-new-highlight'); }
        return;
    }

    if(!autoPlay) {
        // AUTOモードOFF（手動）
        btnMode.textContent = t('▶ AUTO: OFF', '▶ AUTO: OFF');
        btnMode.className = 'btn-auto-off';
        if(btnPause) { btnPause.style.display = 'none'; }
    } else if(!autoPaused) {
        // AUTOモードON・実行中
        btnMode.textContent = t('⏹ AUTO: ON', '⏹ AUTO: ON');
        btnMode.className = 'btn-auto-on';
        if(btnPause) {
            btnPause.style.display = 'inline-flex';
            btnPause.textContent = t('⏸ 停止', '⏸ Pause');
            btnPause.className = 'btn-pause-active';
        }
    } else {
        // AUTOモードON・一時停止中
        btnMode.textContent = t('⏹ AUTO: ON', '⏹ AUTO: ON');
        btnMode.className = 'btn-auto-on';
        if(btnPause) {
            btnPause.style.display = 'inline-flex';
            btnPause.textContent = t('▶ 再開', '▶ Resume');
            btnPause.className = 'btn-pause-resume';
        }
    }

    if(btnNew) { btnNew.classList.remove('btn-new-highlight'); }
}

function toggleLog(){ document.body.classList.toggle('show-log'); safeInvalidateMap(); }

function setHint(text, level){
  const msg = text || "";

  const bar = document.getElementById("statusBar");
  if (bar){
    bar.textContent = msg;
    bar.classList.remove("is-warning", "is-danger", "is-paused");
    if (level === "warning") bar.classList.add("is-warning");
    if (level === "danger")  bar.classList.add("is-danger");
    // ★ 一時停止中はステータスバーをオレンジに
    if (autoPaused) bar.classList.add("is-paused");
    return;
  }

  const old = document.getElementById("hint-area");
  if (old){
    old.textContent = msg;
    return;
  }
}

function renderAll() {
    const rad = (map && map.getZoom) ? (map.getZoom() < 12 ? 2 : (map.getZoom() < 14 ? 4 : 6)) : 4;
    const playable = (isWaitingHuman && turnIndex === 0) ? getPlayableIndices(players[0]) : [];
    if(autoPaused) {
        setHint(t('⏸ AUTO一時停止中 — 「▶ 再開」で続ける', '⏸ AUTO Paused — tap ▶ Resume'));
    } else if(isWaitingHuman && turnIndex === 0){
        if(playable.length) setHint(t('💡 出せるカードをタップ', '💡 Tap a playable card'));
        else if(deck.length) setHint(t('💡 DECKをタップして1枚引く', '💡 Tap DECK to draw'));
    } else {
        setHint(gameOver ? t('対局終了', 'Game Over') : t('待ち：', 'Waiting: ') + players[turnIndex].name + t('の番', '\'s turn'));
    }

    document.getElementById('players-area').innerHTML = players.map((p, i) => {
        const isTurn = (i === turnIndex && !gameOver && p.status === 'active');
        const cardsHtml = p.hand.map((c, ci) => {
            const canPlay = (p.isHuman && !autoPlay && isWaitingHuman && turnIndex === 0 && playable.includes(ci));
            if (!p.isHuman && !autoPlay) {
                return '<div class="card ' + (canPlay?'playable':(p.isHuman?'unplayable':'')) + '" style="background-image:url(' + BACK_URL + ')"></div>';
            }
            const className = canPlay ? 'playable' : (p.isHuman ? 'unplayable' : '');
            const onclickAttr = canPlay ? 'onclick="humanPlay(' + ci + ')"' : '';
            return createHandCardHTML(c, className, onclickAttr);
        }).join('');
        let stCount = 0;
        Object.values(mapState).forEach(owner => { if(owner === i) stCount++; });
        const infoClass = isTurn ? 'player-info-row player-info-row--active' : 'player-info-row';
        const turnLabel = isTurn
            ? (p.isHuman && !autoPlay
                ? ' <span class="turn-label turn-label--human">⬅️</span>'
                : ' <span class="turn-label turn-label--cpu">⬅️</span>')
            : '';
        return '<div class="player-box ' + (isTurn?'active-turn':'') + ' ' + (p.status==='eliminated'?'eliminated':'') + 
               '" style="border-left-color:' + p.color + '">'
               + '<div class="' + infoClass + '"><b>' + p.icon + ' ' + p.name + 
               '</b> <small>Stations:' + stCount + ' | GUNO:' + p.guno + ' | Score:' + calculateScore(i) + '</small>' + turnLabel + '</div>'
               + '<div class="player-cards-row">' + cardsHtml + '</div></div>';
    }).join('');

    updateStationNodeIcons();
    const top = discardPile[discardPile.length-1];
    if (top) {
        if (top.type === 'teiden') {
            document.getElementById('discard-pile').innerHTML = `
                <div class="card card-large guno-card guno-card--teiden" data-line="${top.lc}" style="--w:var(--card-w); margin:0;">
                    <div class="teiden-icon" aria-label="停電">⚡</div>
                    <div class="teiden-sub">停電</div>
                    <div class="teiden-en">Blackout</div>
                </div>
            `;
        } else {
            const st = STATIONS_DB.find(s => s.lc === top.lc && s.order === top.order);
            if (st) {
                const shortNameClass = st.st_ja.replace('★', '').length === 2 ? 'short-name' : '';
                document.getElementById('discard-pile').innerHTML = `
                    <div class="card card-large guno-card" data-line="${top.lc}" style="--w:var(--card-w); margin:0;">
                        <div class="corner corner--tl">
                            <div class="corner-bg"></div>
                            <div class="corner-num">${top.order}</div>
                        </div>
                        <div class="corner corner--br">
                            <div class="corner-bg"></div>
                            <div class="corner-num corner-num--rot">${top.order}</div>
                        </div>
                        <div class="center">
                            <div class="station-jp ${shortNameClass}">${st.st_ja}</div>
                            <div class="station-en">${st.st_en}</div>
                        </div>
                        <div class="route-code">${top.lc}</div>
                    </div>
                `;
            } else {
                document.getElementById('discard-pile').innerHTML = `<div class="card card-large" style="background-image:url(${IMAGE_BASE_URL}${top.file}.png)"></div>`;
            }
        }
    } else {
        document.getElementById('discard-pile').innerHTML = '';
    }
    const drawPileEl = document.getElementById('draw-pile-visual');
    drawPileEl.textContent = deck.length;
    let dpClass = 'guno-back';
    if (isWaitingHuman && playable.length === 0 && deck.length > 0) dpClass += ' can-draw';
    if (deck.length > 0 && deck.length <= 5) dpClass += ' deck-low';
    drawPileEl.className = dpClass;
    document.getElementById('direction-arrow').textContent = direction === 1 ? '↻' : '↺';

    updateMapVisuals();
    renderSlots();
}

/** 駅カードHTML生成（手札用） */
function createHandCardHTML(card, className, onclick) {
    if (card.type === 'teiden') {
        return `
            <div class="card guno-card guno-card--teiden ${className}" data-line="${card.lc}" style="--w:var(--card-w); margin:0;" ${onclick}>
                <div class="teiden-icon" aria-label="停電">⚡</div>
                <div class="teiden-sub">停電</div>
                <div class="teiden-en">Blackout</div>
            </div>
        `;
    }
    const st = STATIONS_DB.find(s => s.lc === card.lc && s.order === card.order);
    if (!st) return `<div class="card ${className}" style="background-image:url(${IMAGE_BASE_URL}${card.file}.png)" ${onclick}></div>`;
    
    const shortNameClass = st.st_ja.replace('★', '').length === 2 ? 'short-name' : '';
    
    return `
        <div class="card guno-card ${className}" data-line="${card.lc}" style="--w:var(--card-w); margin:0;" ${onclick}>
            <div class="corner corner--tl">
                <div class="corner-bg"></div>
                <div class="corner-num">${card.order}</div>
            </div>
            <div class="corner corner--br">
                <div class="corner-bg"></div>
                <div class="corner-num corner-num--rot">${card.order}</div>
            </div>
            <div class="center">
                <div class="station-jp ${shortNameClass}">${st.st_ja}</div>
                <div class="station-en">${st.st_en}</div>
            </div>
            <div class="route-code">${card.lc}</div>
        </div>
    `;
}

/** 駅カードHTML生成（ゲーム中のスロット用） */
function createStationCardHTML(line, num, jp, en, borderColor, playerIcon) {
    const shortNameClass = jp.replace('★', '').length === 2 ? 'short-name' : '';
    
    return `
        <div class="slot active guno-card" data-line="${line}" style="border:2px solid ${borderColor}; --w:var(--card-w); margin:0;">
            <div class="corner corner--tl">
                <div class="corner-bg"></div>
                <div class="corner-num">${num}</div>
            </div>
            <div class="corner corner--br">
                <div class="corner-bg"></div>
                <div class="corner-num corner-num--rot">${num}</div>
            </div>
            <div class="center">
                <div class="station-jp ${shortNameClass}">${jp}</div>
                <div class="station-en">${en}</div>
            </div>
            <div class="route-code">${line}</div>
            <div style="position:absolute; bottom:2px; left:50%; transform:translateX(-50%); background:${borderColor}; width:20px; height:20px; border-radius:50%; border:1px solid #fff; display:flex; align-items:center; justify-content:center; font-size:10px; color:white; z-index:10;">${playerIcon}</div>
        </div>
    `;
}

function renderSlots() {

    ['JY','M','G','T'].forEach(lc => {

        const grid = document.getElementById('map-' + lc.toLowerCase());
        const header = document.getElementById('header-' + lc.toLowerCase());
        const line = STATIONS_DB.find(s=>s.lc===lc);

        header.textContent = '[' + lc + '] ' + (isJapanese ? line.name_ja : line.name_en);
        header.style.backgroundColor = line.color;

        let h = "";

        for(let i=1; i<=10; i++) {

            const o = mapState[lc + "-" + i];
            const s = STATIONS_DB.find(x=>x.lc===lc && x.order===i);

            if(o !== undefined && o !== -1) {

                const isWinner =
                    winnerIdx !== undefined &&
                    o === winnerIdx;

                let cardHTML = createStationCardHTML(
                    lc,
                    i,
                    s.st_ja,
                    s.st_en,
                    players[o].color,
                    players[o].icon
                );

                if(isWinner){
                    cardHTML = cardHTML.replace(
                        'slot active',
                        'slot active winner-glow'
                    );
                }

                h += cardHTML;

            } else {

                h += `
                    <div class="slot">
                        <div>${i}</div>
                        <div style="font-size:8px;">
                            ${(isJapanese ? s.st_ja : s.st_en)
                                .replace('★','<span style="color:gold;">★</span>')}
                        </div>
                    </div>
                `;
            }
        }

        grid.innerHTML = h;
    });

    const blackoutGrid = document.getElementById('map-blackout');

    const lineInfo = {
        'JY': {color: '#00AA00', name_ja: '山手線', name_en: 'Yamanote'},
        'M': {color: '#F62E36', name_ja: '丸ノ内線', name_en: 'Marunouchi'},
        'G': {color: '#FF9500', name_ja: '銀座線', name_en: 'Ginza'},
        'T': {color: '#009BBF', name_ja: '東西線', name_en: 'Tozai'}
    };

    let bh = "";

    ['JY','M','G','T'].forEach(lc => {

        const info = lineInfo[lc];
        const lineName = isJapanese ? info.name_ja : info.name_en;

        if(teidenPlayed[lc]) {

            bh += `
                <div class="slot active guno-card guno-card--teiden"
                     data-line="${lc}"
                     style="border:2px solid #fff; --w:var(--card-w); margin:0;">
                    <div class="teiden-icon">⚡</div>
                    <div class="teiden-sub">停電</div>
                    <div class="teiden-en">Blackout</div>
                </div>
            `;

        } else {

            bh += `
                <div class="slot" style="background:#1a1a1a;">
                    <div style="position:absolute; top:8px; left:50%; transform:translateX(-50%);
                                font-weight:bold; font-size:14px; color:${info.color};">
                        [${lc}]
                    </div>
                    <div style="position:absolute; top:28px; left:50%; transform:translateX(-50%);
                                font-size:10px; color:${info.color}; white-space:nowrap;">
                        ${lineName}
                    </div>
                    <div style="position:absolute; bottom:8px; left:50%; transform:translateX(-50%);
                                font-size:24px;">⚡</div>
                </div>
            `;
        }
    });

    blackoutGrid.innerHTML = bh;
}

function toggleLanguage() { 
    isJapanese = !isJapanese; 
    Object.values(stationNodes).forEach(node => { 
        const st = node.lines[0].stData; 
        node.marker.unbindTooltip(); 
        const stName = isJapanese ? st.st_ja : st.st_en; 
        const label = stName.startsWith('★') ? '<span style="color:gold; font-size:14px;">★</span>' + stName.substring(1) : stName; 
        node.marker.bindTooltip(label, { permanent: true, direction: 'top', className: 'station-label', offset:[0,-10] }); 
    }); 
    document.getElementById('btn-log-text').textContent = t('ログ', 'Log');
    document.getElementById('btn-new-text').textContent = t('新規', 'New');
    document.getElementById('log-title').textContent = t('📜 ログ履歴', '📜 Log History');
    document.getElementById('btn-close-log').textContent = t('閉じる', 'Close');
    updateModeButton();
    renderSlots(); 
    renderAll(); 
}

// ====== GUNO Card Overlay JS (cards demo) ======
function adjustFontByLength(cardEl, jpText, enText){
  const jpEl = cardEl.querySelector(".station-jp");
  const enEl = cardEl.querySelector(".station-en");

  const jpLen = (jpText || "").length;
  const enLen = (enText || "").length;

  if (jpLen <= 3) {
    jpEl.style.fontSize = "calc(var(--w) * 0.155)";
  } else if (jpLen <= 5) {
    jpEl.style.fontSize = "calc(var(--w) * 0.142)";
  } else if (jpLen <= 8) {
    jpEl.style.fontSize = "calc(var(--w) * 0.132)";
  } else {
    jpEl.style.fontSize = "calc(var(--w) * 0.120)";
  }

  if (enLen <= 8) {
    enEl.style.fontSize = "calc(var(--w) * 0.070)";
  } else if (enLen <= 14) {
    enEl.style.fontSize = "calc(var(--w) * 0.063)";
  } else {
    enEl.style.fontSize = "calc(var(--w) * 0.058)";
  }
}

/** 1枚カードDOM作成 */
function createCard({line, num, jp, en}, opts = {}){
  const card = document.createElement("div");
  card.className = "guno-card" + (opts.small ? " is-small" : "");
  card.dataset.line = line;

  card.innerHTML = `
    <div class="corner corner--tl">
      <div class="corner-bg"></div>
      <div class="corner-num">${num}</div>
    </div>

    <div class="corner corner--br">
      <div class="corner-bg"></div>
      <div class="corner-num corner-num--rot">${num}</div>
    </div>

    <div class="center">
      <div class="station-jp"></div>
      <div class="station-en"></div>
    </div>

    <div class="route-code">${line}</div>
  `;

  card.querySelector(".station-jp").textContent = jp;
  card.querySelector(".station-en").textContent = en;

  adjustFontByLength(card, jp, en);

  return card;
}

/** 一括描画 */
function renderCards(){
  const grid = document.getElementById("cardGrid");
  if (!grid) return;

  grid.innerHTML = "";
  for (const row of STATION_DB_CARDS){
    grid.appendChild(createCard(row));
  }
}
