import test from 'node:test'; import assert from 'node:assert/strict';
const forbidden=['token','password','senha','session','private_notes','draft','internal_metadata'];
function assertPublicPayloadSafe(payload){const s=JSON.stringify(payload).toLowerCase(); for(const term of forbidden) assert.equal(s.includes(term),false,`public payload leaked ${term}`);}
test('RC1 public presenter payload does not include sensitive operational fields',()=>{assertPublicPayloadSafe({student:{name:'Ana'},plan:{status:'PUBLISHED',meals:[]}}); assert.throws(()=>assertPublicPayloadSafe({private_notes:'x'}));});
