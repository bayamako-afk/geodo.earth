// ui_v405.js (DOM rendering only)
// Generated from guno_V4_051.html (v4.05) for V5 split

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
    if(autoTimer) clearTimeout(autoTimer);
    gameOver = false; turnCount = 0; turnIndex = 0; direction = 1; isWaitingHuman = false; mapState = {}; lastHits = {}; consecutivePasses = 0;
    teidenPlayed = { JY:false, M:false, G:false, T:false };
    deck = []; STATIONS_DB.forEach(s => { for(let i=0; i<2; i++) deck.push({...s, type:'station', id:'s-' + s.lc + '-' + s.order + '-' + i}); });
    ['JY','M','G','T'].forEach(lc => deck.push({lc, type:'teiden', file:TEIDEN_FILES[lc], id:'t-' + lc, color:'#000'}));
    deck.sort(() => Math.random() - 0.5);
    players = [
        { name: "P1", isHuman: !autoPlay, hand: [], color: '#174a7c', icon: '🌊', status: 'active', guno: 0 },
        { name: "P2", isHuman: false, hand: [], color: '#b52942', icon: '🌸', status: 'active', guno: 0 },
        { name: "P3", isHuman: false, hand: [], color: '#e6b422', icon: '🌙', status: 'active', guno: 0 },
        { name: "P4", isHuman: false, hand: [], color: '#745399', icon: '🏯', status: 'active', guno: 0 }
    ];
    players.forEach(p => { for(let i=0; i<7; i++) p.hand.push(deck.pop()); });
    discardPile = []; while(true) { let c = deck.pop(); discardPile.push(c); if(c.type==='station'){ mapState[c.lc + "-" + c.order]=-1; break; } }
    document.getElementById('log').innerHTML = ""; document.getElementById('result-overlay').style.display = 'none';
    updateModeButton();
    nextTurn();
}

function nextTurn() {
    if(gameOver) return;
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

function humanDraw() { 
    if(!isWaitingHuman || turnIndex !== 0 || getPlayableIndices(players[0]).length > 0 || !deck.length) return; 
    players[0].hand.push(deck.pop()); 
    playSE('seDraw', 0.6);  // カード引く音
        log(t('🎴 <b>' + players[0].name + '</b> がカードを引きました', '🎴 <b>' + players[0].name + '</b> drew a card'));
    renderAll();
    // 引いたカードが出せるか再評価
    const playable = getPlayableIndices(players[0]);
    if(playable.length > 0) {
        // 出せるカードがあるので続行
        return;
    }
    // 出せるカードがないのでターン終了
    isWaitingHuman = false; 
    advanceTurn(); 
    nextTurn(); 
}
function humanPlay(idx) { if(!isWaitingHuman || turnIndex !== 0 || !getPlayableIndices(players[0]).includes(idx)) return; isWaitingHuman = false; executePlay(0, idx); advanceTurn(); nextTurn(); }



function playCPUTurn() { 
    const p = players[turnIndex];
    let pi = getPlayableIndices(p); 
    if(pi.length) {
        // 出せるカードがあるので出す
        executePlay(turnIndex, pi[0]); 
    } else if(deck.length) {
        // 出せるカードがないので引く
        p.hand.push(deck.pop()); 
        playSE('seDraw', 0.6);  // カード引く音
        log(t('🎴 <b>' + p.name + '</b> がカードを引きました', '🎴 <b>' + p.name + '</b> drew a card'));
        // 引いたカードが出せるか再評価
        pi = getPlayableIndices(p);
        if(pi.length) {
            // 引いたカードが出せるので出す
            executePlay(turnIndex, pi[0]);
        }
    } else {
        // デッキが空で出せるカードもない
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
    // その路線の10駅すべてが埋まっているかチェック
    let filledCount = 0;
    for(let i=1; i<=10; i++) {
        const owner = mapState[lc + "-" + i];
        if(owner !== undefined && owner !== -1) {
            filledCount++;
        }
    }
    // デバッグログ
    console.log('[DEBUG] ' + players[pIdx].name + ' ' + lc + ' プレイ | 埋まった駅: ' + filledCount + '/10 | lastHits[' + lc + ']=' + (lastHits[lc] !== undefined ? players[lastHits[lc]].name : 'none'));
    
    // GUNO達成判定：10駅すべてが埋まったかつ、まだGUNOされていない場合
    if (filledCount === 10 && lastHits[lc] === undefined){ 
        lastHits[lc] = pIdx; 
        players[pIdx].guno++; 
        console.log('[GUNO!] ' + players[pIdx].name + ' が ' + lc + ' を完成！（10駅すべて埋まった）');
        log(t('🎆 <b>' + players[pIdx].name + '</b> が ' + lc + ' を完成！(GUNO達成)', '🎆 <b>' + players[pIdx].name + '</b> completed ' + lc + '! (GUNO)'));
        playSE('seGuno', 1.0);  // GUNO成立音
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } }); 
        // 4路線すべてが完成したかチェック
        const totalGuno = players.reduce((sum, p) => sum + p.guno, 0);
        if(totalGuno >= 4) endGame(); 
    }
}
function endGame() { gameOver = true; if(autoTimer) clearTimeout(autoTimer); renderAll(); document.getElementById('result-overlay').style.display = 'flex'; showRanking(); playSE('seEnd', 1.0);confetti({ particleCount: 200, spread: 100 }); }

function getOwnedStationsByPlayer(pIdx){
  // STATIONS_DB が const の場合でも拾う
  const db = (window.STATIONS_DB || (typeof STATIONS_DB !== "undefined" ? STATIONS_DB : []));
  return db.filter(st => {
    const key = `${st.lc}-${st.order}`;      // mapState のキー仕様に合わせる
    return mapState[key] === pIdx;
  });
}

function showRanking() {
  const data = players.map((p, idx) => {
    const ownedStations = getOwnedStationsByPlayer(idx);
    const stCount = ownedStations.length;

    const gunoPts = p.guno * GUNO_POINT;
    const base = gunoPts + stCount;

    const connBonus = calcConnectionBonus(ownedStations); // ★追加（degree-1合計）
    const total = base + connBonus;

    const isAlive = p.status !== 'eliminated';

    return { p, stCount, gunoPts, base, connBonus, total, isAlive, ownedStations };
  });

  // 生存優先 → 合計点
  const ranking = data.sort((a,b) => {
    if(a.isAlive !== b.isAlive) return b.isAlive - a.isAlive;
    return b.total - a.total;
  });

  // 表を作る（内訳列を追加）
  let rows = "";
  ranking.forEach((r, i) => {
    const style = (i === 0) ? 'style="color:gold; font-weight:bold;"' : "";
    rows +=
      '<tr ' + style + '>' +
        '<td>' + (i+1) + '</td>' +
        '<td>' + r.p.icon + ' ' + r.p.name + '</td>' +
        '<td>' + r.total + '</td>' +
        '<td>' + r.base + '</td>' +
        '<td>+' + r.connBonus + '</td>' +
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

  // ★ 取得駅一覧（接続数順）を追加表示（表の下に）
  renderStationBreakdown(ranking);
}

function renderStationBreakdown(ranking){
  // 置き場を用意（なければ作る）
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

function toggleAuto() { 
    autoPlay = !autoPlay; players[0].isHuman = !autoPlay; updateModeButton();
    if (autoTimer) clearTimeout(autoTimer);
    if(!gameOver) { isWaitingHuman = (turnIndex===0 && !autoPlay); renderAll(); if(autoPlay) nextTurn(); }
}
function updateModeButton() {
    const btn = document.getElementById('btn-mode');
    btn.textContent = autoPlay ? "⏸️ AUTO: ON" : "▶️ AUTO: OFF";
    btn.className = autoPlay ? "btn-auto-active" : "btn-manual";
}
function toggleLog(){ document.body.classList.toggle('show-log'); safeInvalidateMap(); }
function setHint(text, level){
  const msg = text || "";

  // 新：ヘッダー直下ステータスバー
  const bar = document.getElementById("statusBar");
  if (bar){
    bar.textContent = msg;
    bar.classList.remove("is-warning", "is-danger");
    if (level === "warning") bar.classList.add("is-warning");
    if (level === "danger")  bar.classList.add("is-danger");
    return;
  }

  // 旧：従来ヒントエリア（残っている場合だけ）
  const old = document.getElementById("hint-area");
  if (old){
    old.textContent = msg;
    return;
  }

  // どちらも無い場合：何もしない（落とさない）
}

function renderAll() {
    const rad = (map && map.getZoom) ? (map.getZoom() < 12 ? 2 : (map.getZoom() < 14 ? 4 : 6)) : 4;
    const playable = (isWaitingHuman && turnIndex === 0) ? getPlayableIndices(players[0]) : [];
    if(isWaitingHuman && turnIndex === 0){
        if(playable.length) setHint(t('💡 出せるカードをタップ', '💡 Tap a playable card'));
        else if(deck.length) setHint(t('💡 DECKをタップして1枚引く', '💡 Tap DECK to draw'));
    } else { setHint(gameOver ? t('対局終了', 'Game Over') : t('待ち：', 'Waiting: ') + players[turnIndex].name + t('の番', '\'s turn')); }

    document.getElementById('players-area').innerHTML = players.map((p, i) => {
        const isTurn = (i === turnIndex && !gameOver && p.status === 'active');
        const cardsHtml = p.hand.map((c, ci) => {
            const canPlay = (p.isHuman && !autoPlay && isWaitingHuman && turnIndex === 0 && playable.includes(ci));
            if (!p.isHuman && !autoPlay) {
                // 相手の手札は裏面画像
                return '<div class="card ' + (canPlay?'playable':(p.isHuman?'unplayable':'')) + '" style="background-image:url(' + BACK_URL + ')"></div>';
            }
            // 自分の手札またはAUTOモード時はオーバーレイカード
            const className = canPlay ? 'playable' : (p.isHuman ? 'unplayable' : '');
            const onclickAttr = canPlay ? 'onclick="humanPlay(' + ci + ')"' : '';
            return createHandCardHTML(c, className, onclickAttr);
        }).join('');
        // ✅ 修正：閉じタグ連結修復
        // Stations（獲得駅数）を計算
        let stCount = 0;
        Object.values(mapState).forEach(owner => { if(owner === i) stCount++; });
        // 表示：Stations（獲得駅数） | GUNO（制覇路線数） | Score（合計）
        return '<div class="player-box ' + (isTurn?'active-turn':'') + ' ' + (p.status==='eliminated'?'eliminated':'') + 
               '" style="border-left-color:' + p.color + '"><b>' + p.icon + ' ' + p.name + 
               '</b> <small>Stations:' + stCount + ' | GUNO:' + p.guno + ' | Score:' + calculateScore(i) + '</small><br>' + cardsHtml + '</div>';
    }).join('');

    updateStationNodeIcons();
    const top = discardPile[discardPile.length-1];
    if (top) {
        if (top.type === 'teiden') {
            // 停電カードもオーバーレイで生成
            document.getElementById('discard-pile').innerHTML = `
                <div class="card card-large guno-card guno-card--teiden" data-line="${top.lc}" style="--w:var(--card-w); margin:0;">
                    <div class="teiden-icon" aria-label="停電">⚡</div>
                    <div class="teiden-sub">停電</div>
                    <div class="teiden-en">Blackout</div>
                </div>
            `;
        } else {
            // 駅カードはオーバーレイで生成
            const st = STATIONS_DB.find(s => s.lc === top.lc && s.order === top.order);
            if (st) {
                // 2文字駅名の場合はshort-nameクラスを追加（★を除外して判定）
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
    document.getElementById('draw-pile-visual').textContent = deck.length;
    document.getElementById('draw-pile-visual').className = (isWaitingHuman && playable.length === 0 && deck.length > 0) ? 'can-draw' : '';
    document.getElementById('direction-arrow').textContent = direction === 1 ? '↻' : '↺';



    updateMapVisuals();
    renderSlots();
}

/** 駅カードHTML生成（手札用） */
function createHandCardHTML(card, className, onclick) {
    if (card.type === 'teiden') {
        // 停電カードもオーバーレイで生成
        return `
            <div class="card guno-card guno-card--teiden ${className}" data-line="${card.lc}" style="--w:var(--card-w); margin:0;" ${onclick}>
                <div class="teiden-icon" aria-label="停電">⚡</div>
                <div class="teiden-sub">停電</div>
                <div class="teiden-en">Blackout</div>
            </div>
        `;
    }
    // 駅カードはオーバーレイで生成
    const st = STATIONS_DB.find(s => s.lc === card.lc && s.order === card.order);
    if (!st) return `<div class="card ${className}" style="background-image:url(${IMAGE_BASE_URL}${card.file}.png)" ${onclick}></div>`;
    
    // 2文字駅名の場合はshort-nameクラスを追加（★を除外して判定）
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
    // 2文字駅名の場合はshort-nameクラスを追加（★を除外して判定）
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
    // 各路線の駅スロット（1-10）
    ['JY','M','G','T'].forEach(lc => {
        const grid = document.getElementById('map-' + lc.toLowerCase());
        const header = document.getElementById('header-' + lc.toLowerCase());
        const line = STATIONS_DB.find(s=>s.lc===lc);
        header.textContent = '[' + lc + '] ' + (isJapanese ? line.name_ja : line.name_en);
        header.style.backgroundColor = line.color;
        let h = "";
        for(let i=1; i<=10; i++) {
            const o = mapState[lc + "-" + i], s = STATIONS_DB.find(x=>x.lc===lc && x.order===i);
            if(o !== undefined && o !== -1) {
                h += createStationCardHTML(lc, i, s.st_ja, s.st_en, players[o].color, players[o].icon);
            } else { h += '<div class="slot"><div>' + i + '</div><div style="font-size:8px;">' + (isJapanese?s.st_ja:s.st_en).replace('★', '<span style="color:gold;">★</span>') + '</div></div>'; }
        }
        grid.innerHTML = h;
    });
    
    // 停電カード専用エリア
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
            // 停電カードが出された場合：オーバーレイで表示
            bh += `
                <div class="slot active guno-card guno-card--teiden" data-line="${lc}" style="border:2px solid #fff; --w:var(--card-w); margin:0;">
                    <div class="teiden-icon" aria-label="停電">⚡</div>
                    <div class="teiden-sub">停電</div>
                    <div class="teiden-en">Blackout</div>
                </div>
            `;
        } else {
            // 停電カードがまだ出されていない場合：空スロット
            bh += `
                <div class="slot" style="background:#1a1a1a;">
                    <div style="position:absolute; top:8px; left:50%; transform:translateX(-50%); font-weight:bold; font-size:14px; color:${info.color}; text-shadow: 2px 2px 4px rgba(0,0,0,0.9), -1px -1px 2px rgba(0,0,0,0.9), 1px -1px 2px rgba(0,0,0,0.9), -1px 1px 2px rgba(0,0,0,0.9);">[${lc}]</div>
                    <div style="position:absolute; top:28px; left:50%; transform:translateX(-50%); font-size:10px; color:${info.color}; white-space:nowrap; text-shadow: 2px 2px 4px rgba(0,0,0,0.9), -1px -1px 2px rgba(0,0,0,0.9), 1px -1px 2px rgba(0,0,0,0.9), -1px 1px 2px rgba(0,0,0,0.9);">${lineName}</div>
                    <div style="position:absolute; bottom:8px; left:50%; transform:translateX(-50%); font-size:24px; text-shadow: 2px 2px 4px rgba(0,0,0,0.9), -1px -1px 2px rgba(0,0,0,0.9), 1px -1px 2px rgba(0,0,0,0.9), -1px 1px 2px rgba(0,0,0,0.9);">⚡</div>
                </div>
            `;
        }
    });
    blackoutGrid.innerHTML = bh;
}
function toggleLanguage() { 
    isJapanese = !isJapanese; 
    // 駅名ラベル更新
    Object.values(stationNodes).forEach(node => { 
        const st = node.lines[0].stData; 
        node.marker.unbindTooltip(); 
        const stName = isJapanese ? st.st_ja : st.st_en; 
        const label = stName.startsWith('★') ? '<span style="color:gold; font-size:14px;">★</span>' + stName.substring(1) : stName; 
        node.marker.bindTooltip(label, { permanent: true, direction: 'top', className: 'station-label', offset:[0,-10] }); 
    }); 
    // UI要素更新
    document.getElementById('btn-log-text').textContent = t('ログ', 'Log');
    document.getElementById('btn-new-text').textContent = t('新規', 'New');
    document.getElementById('log-title').textContent = t('📜 ログ履歴', '📜 Log History');
    document.getElementById('btn-close-log').textContent = t('閉じる', 'Close');
    renderSlots(); 
    renderAll(); 
}

// ====== GUNO Card Overlay JS (cards demo) ======
function adjustFontByLength(cardEl, jpText, enText){
  const jpEl = cardEl.querySelector(".station-jp");
  const enEl = cardEl.querySelector(".station-en");

  const jpLen = (jpText || "").length;
  const enLen = (enText || "").length;

  // JP: 2-3文字は大きく、長いほど少し下げる
  if (jpLen <= 3) {
    jpEl.style.fontSize = "calc(var(--w) * 0.155)";
  } else if (jpLen <= 5) {
    jpEl.style.fontSize = "calc(var(--w) * 0.142)";
  } else if (jpLen <= 8) {
    jpEl.style.fontSize = "calc(var(--w) * 0.132)";
  } else {
    jpEl.style.fontSize = "calc(var(--w) * 0.120)";
  }

  // EN: 長い時だけ下げる
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
