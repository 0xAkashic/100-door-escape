const fs=require('fs');
const path=require('path');
const puzzles=JSON.parse(fs.readFileSync('www/image-puzzles/puzzles.json','utf8'));
if(puzzles.length!==100) throw new Error(`Expected 100 image puzzles, got ${puzzles.length}`);
const ids=new Set();
for(const p of puzzles){
  if(!p.id||ids.has(p.id)) throw new Error(`Invalid/duplicate id: ${p.id}`);
  ids.add(p.id);
  if(!p.title||!p.question||!p.answer) throw new Error(`Missing required field at image puzzle ${p.id}`);
  if(p.choices && !p.choices.map(String).includes(String(p.answer))) throw new Error(`Answer not in choices at image puzzle ${p.id}`);
  if(!p.kind||!p.data) throw new Error(`Missing kind/data at image puzzle ${p.id}`);
}
console.log('100 image puzzles validated.');

// Image asset validation
for (const p of puzzles) {
  if (!p.image) throw new Error(`Missing image path for puzzle ${p.id}`);
  const asset = path.resolve(__dirname, '..', 'www', p.image);
  if (!fs.existsSync(asset)) throw new Error(`Missing image asset for puzzle ${p.id}: ${p.image}`);
}
console.log('100 image assets validated successfully');
