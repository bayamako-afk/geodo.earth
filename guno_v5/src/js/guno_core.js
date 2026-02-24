window.GUNO = {
  isJapanese: true,
  auto: false,
  players: [],
  current: 0,
  direction: 1,
  deck: [],
  discard: null,
  slots: {}, // { line_code: {1:card,2:card...10:card} }
};

function makeDeck(){
  const deck = [];
  for (const line of window.GUNO_LINES){
    for (const st of line.stations){
      deck.push({
        type:"station",
        line: line.line_code,
        n: st.n,
        ja: st.ja, en: st.en,
        lat: st.lat, lon: st.lon
      });
    }
  }
  // シャッフル
  for (let i = deck.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function initState(){
  const S = window.GUNO;
  S.players = [
    { id:"P1", hand:[], score:0 },
    { id:"P2", hand:[], score:0 },
    { id:"P3", hand:[], score:0 },
    { id:"P4", hand:[], score:0 },
  ];
  S.current = 0;
  S.direction = 1;
  S.deck = makeDeck();
  S.discard = null;
  S.slots = {};
  for (const line of window.GUNO_LINES){
    S.slots[line.line_code] = {};
  }
}

function drawCard(){
  const S = window.GUNO;
  if (S.deck.length === 0) return null;
  return S.deck.pop();
}

function canPlay(card){
  const S = window.GUNO;
  // ルール最小：同じ路線なら出せる / もしくは空なら出せる
  if (!S.discard) return true;
  return card.line === S.discard.line;
}

function playCard(playerIndex, handIndex){
  const S = window.GUNO;
  const p = S.players[playerIndex];
  const card = p.hand[handIndex];
  if (!card) return false;
  if (!canPlay(card)) return false;

  // スロットへ置く（番号位置）
  S.slots[card.line][card.n] = card;
  S.discard = card;
  p.hand.splice(handIndex, 1);

  // 次へ
  S.current = (S.current + S.direction + S.players.length) % S.players.length;
  return true;
}

function dealInitial(){
  const S = window.GUNO;
  for (let r = 0; r < 7; r++){
    for (let i = 0; i < S.players.length; i++){
      const c = drawCard();
      if (c) S.players[i].hand.push(c);
    }
  }
  // 最初の捨て札
  S.discard = drawCard();
}