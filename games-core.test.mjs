import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,existsSync } from 'node:fs';
import { shuffle, matchesAnswer, scorePercent, readProgress, recordResult, markFirstAttempt, loadingBalance, PROGRESS_KEY, GAME_IDS } from './games-core.mjs';
import { GAMES, PARTS, PHOTOS, STABILITY, BENDING, DEFECTS, SHIP_TYPES, LOAD_LEVELS, BOUNDARIES } from './games-data.mjs';
import { ZONES, BOUNDARY_POINTS, crossSection } from './games-visuals.mjs';

test('all ten games have valid lesson links, required content and distinct identities',()=>{
  const index=readFileSync(new URL('./index.html',import.meta.url),'utf8');
  const lessons=new Set([...index.matchAll(/makeLesson\('([^']+)'/g)].map(match=>match[1]));
  assert.deepEqual(GAMES.map(game=>game.id),GAME_IDS);
  for(const entry of [...GAMES,...PARTS,...DEFECTS]) assert.ok(lessons.has(entry.lesson),`${entry.id}: ${entry.lesson}`);
  assert.equal(new Set(ZONES.map(zone=>zone.id)).size,PARTS.length);
  for(const part of PARTS) assert.ok(ZONES.some(zone=>zone.id===part.id));
  assert.equal(STABILITY.length,6);assert.equal(BENDING.length,6);assert.equal(DEFECTS.length,5);assert.equal(SHIP_TYPES.length,6);
  for(const question of [...STABILITY,...BENDING]) assert.ok(question.options[question.answer]);
  for(const boundary of BOUNDARIES)for(const target of boundary.targets)assert.ok(BOUNDARY_POINTS.some(point=>point.id===target));
  for(const photo of Object.values(PHOTOS)){assert.ok(existsSync(new URL(photo.src,import.meta.url)));assert.ok(photo.author&&photo.license&&photo.source.startsWith('https://commons.wikimedia.org/'));}
});
test('recall accepts explicit aliases and regional spelling without accepting near misses',()=>{
  assert.ok(matchesAnswer('  CENTER-GIRDER ',['centre girder']));
  assert.ok(matchesAnswer('inner bottom',PARTS.find(part=>part.id==='tanktop').aliases));
  assert.ok(matchesAnswer('Tank Top',PARTS.find(part=>part.id==='tanktop').aliases));
  assert.equal(matchesAnswer('girder',['centre girder']),false);
  assert.equal(matchesAnswer('rudder',['propeller']),false);
  assert.equal(matchesAnswer('',['']),false);
});
test('first attempts are immutable across retries and score stays bounded',()=>{
  const state={earned:0,attempts:{}};
  assert.equal(markFirstAttempt(state,'part',false),true);
  assert.equal(markFirstAttempt(state,'part',true),false);
  markFirstAttempt(state,'next',true);markFirstAttempt(state,'next',true);
  assert.equal(state.earned,1);assert.equal(scorePercent(state.earned,2),50);
  assert.equal(scorePercent(1,8),13);assert.equal(scorePercent(5,0),0);
  assert.equal(scorePercent(-2,10),0);assert.equal(scorePercent(300,1),100);assert.equal(scorePercent(NaN,1),0);
});
test('progress recovers from bad storage and keeps practice and timed records separate',()=>{
  for(const raw of [null,'bad','null','[]','{"version":2,"games":{}}'])assert.deepEqual(readProgress(raw),{version:1,games:{}});
  let value=recordResult(readProgress(null),'build','practice',7,8,'2026-11-14');
  value=recordResult(value,'build','practice',2,8,'2026-11-14');
  value=recordResult(value,'build','challenge',3,8,'2026-11-14');
  assert.equal(value.games.build.practice.best,88);assert.equal(value.games.build.practice.runs,2);
  assert.equal(value.games.build.challenge.best,38);assert.equal(value.games.build.challenge.runs,1);
  assert.equal(Object.keys(readProgress('{"version":1,"games":{"evil":{},"build":{"practice":{"best":-1,"runs":2}}}}').games).length,1);
  assert.throws(()=>recordResult(value,'unknown','practice',1,1));
  assert.notEqual(PROGRESS_KEY,'shipstruct-academy-progress-v1');
});
test('every loading level can be solved with six unique positions and rejects duplicates or missing cargo',()=>{
  // Equal pairs can use three opposite pairs: fore-port/aft-starboard,
  // fore-starboard/aft-port, midship-port/midship-starboard.
  const solution=['0','8','2','6','3','5'];
  for(const level of LOAD_LEVELS){
    const result=loadingBalance(level.weights,solution,level.capacity);assert.equal(result.balanced,true);assert.equal(result.longitudinal,0);assert.equal(result.transverse,0);
    assert.equal(loadingBalance(level.weights,['0','0','2','6','3','5'],level.capacity).valid,false);
    assert.equal(loadingBalance(level.weights,['0','8',null,'6','3','5'],level.capacity).valid,false);
    assert.equal(loadingBalance(level.weights,solution,level.capacity-1).valid,false);
  }
  assert.equal(loadingBalance([1,2],['0','8']).balanced,false);
});
test('shuffle preserves entries without mutating original and diagrams use unique pattern IDs',()=>{
  const input=[1,2,3,4],result=shuffle(input,()=>0);
  assert.deepEqual(input,[1,2,3,4]);assert.deepEqual([...result].sort(),input);assert.notDeepEqual(result,input);
  const a=crossSection(),b=crossSection();
  assert.notEqual(a.match(/id="(drawing-grid-\d+)"/)[1],b.match(/id="(drawing-grid-\d+)"/)[1]);
});
