const TABLES = "/api/games/bang/tables";

function body(response, expected) {
  if (response.status !== expected)
    throw new Error(`HTTP ${response.status} au lieu de ${expected}`);
  return response.body;
}

export function playTurn(table, client) {
  const path = `${TABLES}/${table.code}`;
  const seat = table.views[0].currentSeat;
  const player = table.players[seat - 1];
  const command = (suffix) =>
    body(client.post(player, `${path}/turn/${suffix}`, "command"), 204);
  command("draw");
  const drawn = body(client.get(player, `${path}/state`, "verification"), 200);
  command("end");
  const health = drawn.players.find(
    (candidate) => candidate.seat === seat,
  ).health;
  for (const card of drawn.hand.slice(0, drawn.hand.length - health)) {
    command(`discard/${encodeURIComponent(card.id)}`);
  }
  command("end");
  const final = table.players.map((session) =>
    body(client.get(session, `${path}/state`, "verification"), 200),
  );
  const expectedHand = drawn.hand.slice(drawn.hand.length - health);
  const applied = final.every((view, index) => {
    const expected =
      view.seat === seat ? expectedHand : table.views[index].hand;
    return (
      view.seat === table.views[index].seat &&
      view.currentSeat === (seat % 4) + 1 &&
      view.phase === "DRAW" &&
      JSON.stringify(view.hand) === JSON.stringify(expected)
    );
  });
  if (!applied) throw new Error("Le serveur ne reflète pas l’effet du tour");
  return final;
}

export function startTable(players, client) {
  const code = body(client.post(players[0], TABLES, "setup"), 201).code;
  const path = `${TABLES}/${code}`;
  for (const player of players.slice(1))
    body(client.post(player, `${path}/join`, "setup"), 200);
  body(client.post(players[0], `${path}/start`, "setup"), 200);
  const views = players.map((player) =>
    body(client.get(player, `${path}/state`, "setup"), 200),
  );
  return { code, players, views };
}
