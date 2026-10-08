"use strict";
const $ = id => document.getElementById(id);
let selectedFile=null, playerURL=null, dbPromise=null;
let recorder=null, chunks=[], frames=0, channels=0, maxPeak=0, clips=0, startTime=0, timer=null, wakeLock=null;
const bytes=n=>n<1048576?Math.round(n/1024)+" KB":(n/1048576).toFixed(1)+" MB";
const time=s=>{const n=Math.floor(Math.max(s,0));return String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0")};
function showTab(tab){
 document.querySelectorAll(".tab").forEach(b=>{const on=b.dataset.tab===tab;b.classList.toggle("active",on);b.setAttribute("aria-selected",String(on))});
 document.querySelectorAll(".page").forEach(el=>el.classList.toggle("hidden",el.id!=="page-"+tab));
 if(tab==="library")refreshLibrary().catch(e=>$("libraryList").textContent="Library unavailable: "+e.message);
}
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>showTab(b.dataset.tab)));

function wavInfo(buf){
 const v=new DataView(buf); if(v.byteLength<44)return null;
 const tag=i=>String.fromCharCode(...new Uint8Array(buf,i,4));
 if(tag(0)!=="RIFF"||tag(8)!=="WAVE")return null;
 let p=12,fmt=null,dataSize=null;
 while(p+8<=v.byteLength){
  const size=v.getUint32(p+4,true),end=p+8+size+(size%2);
  if(tag(p)==="fmt "&&size>=16&&p+24<=v.byteLength)fmt={codec:v.getUint16(p+8,true),channels:v.getUint16(p+10,true),rate:v.getUint32(p+12,true),bytesPerSec:v.getUint32(p+16,true),bits:v.getUint16(p+22,true)};
  if(tag(p)==="data"){dataSize=Math.min(size,v.byteLength-p-8);break;}
  if(end<=p||end>v.byteLength)break;
  p=end;
 }
 return fmt?Object.assign(fmt,{duration:fmt.bytesPerSec?dataSize/fmt.bytesPerSec:null}):null;
}
async function loadFile(file,stored=false){
 if(playerURL)URL.revokeObjectURL(playerURL);
 selectedFile=file;playerURL=URL.createObjectURL(file);
 const player=$("player");player.pause();player.src=playerURL;player.load();
 $("loadSelection").classList.remove("hidden");
 $("loadName").textContent=file.name||"Unnamed recording";
 let info=null;
 try{info=wavInfo(await file.arrayBuffer())}catch(e){}
 const fields=[bytes(file.size)];
 if(info)fields.push(info.channels+" channels",(info.rate/1000).toFixed(1)+" kHz",info.bits+"-bit",time(info.duration||0));
 else fields.push("Unrecognized WAV");
 const meta=$("loadMetadata");meta.replaceChildren();
 for(const f of fields){const s=document.createElement("span");s.textContent=f;meta.append(s)}
 const warning=$("loadWarning");warning.classList.remove("hidden");
 if(!info)warning.textContent="File is not a readable standard RIFF WAV.";
 else if(info.channels!==2)warning.textContent="This "+info.channels+"-channel file is not a verified stereo PO-35 backup.";
 else if(info.rate<44100||info.bits<16)warning.textContent="Below 16-bit / 44.1 kHz. Restore reliability is uncertain.";
 else if(info.codec!==1&&info.codec!==3&&info.codec!==65534)warning.textContent="Unusual WAV encoding. PCM is preferred.";
 else warning.classList.add("hidden");
 $("storeImport").disabled=stored;$("storeImport").textContent=stored?"Already in library":"Add to library";
 showTab("load");
}
$("chooseWav").addEventListener("change",async e=>{if(e.target.files[0])await loadFile(e.target.files[0]);e.target.value=""});

function db(){
 if(dbPromise)return dbPromise;
 dbPromise=new Promise((resolve,reject)=>{const req=indexedDB.open("po35-bridge-library",1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains("files"))req.result.createObjectStore("files",{keyPath:"id"})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
 return dbPromise;
}
async function storeFile(item){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction("files","readwrite");tx.objectStore("files").put(item);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
async function removeFile(id){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction("files","readwrite");tx.objectStore("files").delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
async function listFiles(){const database=await db();return new Promise((resolve,reject)=>{const req=database.transaction("files","readonly").objectStore("files").getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
$("storeImport").addEventListener("click",async()=>{if(!selectedFile)return;try{await storeFile({id:crypto.randomUUID(),name:selectedFile.name,created:Date.now(),blob:selectedFile});$("storeImport").disabled=true;$("storeImport").textContent="Stored"}catch(e){alert("Could not store locally: "+e.message)}});
async function shareWav(blob,name){
 const file=new File([blob],String(name).replace(/[\\/:*?"<>|]/g,"_"),{type:"audio/wav"});
 if(navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:name});return}catch(e){if(e.name==="AbortError")return}}
 const url=URL.createObjectURL(file),link=document.createElement("a");link.href=url;link.download=file.name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
async function refreshLibrary(){
 const entries=await listFiles();entries.sort((a,b)=>b.created-a.created);
 const area=$("libraryList");area.replaceChildren();
 if(!entries.length){const empty=document.createElement("p");empty.className="empty";empty.textContent="No WAV files here yet. Import a backup under Load, or record a test under Save.";area.append(empty);return}
 for(const item of entries){
  const article=document.createElement("article");article.className="library-entry";
  const title=document.createElement("h3");title.textContent=item.name;article.append(title);
  const subtitle=document.createElement("small");subtitle.textContent=new Date(item.created).toLocaleString()+" · "+bytes(item.blob.size);article.append(subtitle);
  const actions=document.createElement("div");actions.className="library-actions";
  const btn=(label,action)=>{const b=document.createElement("button");b.type="button";b.className="smallbutton";b.textContent=label;b.addEventListener("click",action);actions.append(b)};
  btn("Load",()=>loadFile(new File([item.blob],item.name,{type:"audio/wav"}),true));
  btn("Export WAV",()=>shareWav(item.blob,item.name));
  btn("Delete",async()=>{if(confirm("Delete this browser copy of "+item.name+"?")){await removeFile(item.id);await refreshLibrary()}});
  article.append(actions);area.append(article);
 }
}
function status(message,error=false){$("recordStatus").textContent=message;$("recordStatus").classList.toggle("error",error)}
function chunk(blocks){
 if(!recorder||!blocks||!blocks.length||!blocks[0].length)return;
 if(!channels)channels=Math.min(2,blocks.length);
 if(blocks.length!==channels)return;
 chunks.push(blocks.map(arr=>new Float32Array(arr)));
 frames+=blocks[0].length;
 let peak=0;
 for(const arr of blocks)for(const value of arr){const v=Math.abs(value);if(v>peak)peak=v;if(v>=.999)clips++}
 maxPeak=Math.max(maxPeak,peak);
 $("meter").style.width=Math.min(100,100*peak)+"%";
 $("peakLabel").textContent="Peak: "+(maxPeak*100).toFixed(1)+"%"+(clips?" · CLIP":"");
}
async function processor(ctx,source){
 if(ctx.audioWorklet){
  try{
   const sourceCode='class RawCapture extends AudioWorkletProcessor { constructor(){super();this.data=[];this.pos=0;this.port.onmessage=e=>{if(e.data==="flush"){this.emit();this.port.postMessage("flushed")}}} emit(){if(!this.pos)return;const a=this.data.map(ch=>ch.slice(0,this.pos));this.port.postMessage({blocks:a},a.map(ch=>ch.buffer));this.pos=0} process(inputs,outputs){const x=inputs[0];for(const out of outputs[0]||[])out.fill(0);if(!x||!x.length)return true;const n=Math.min(x.length,2);if(n!==this.data.length){this.emit();this.data=Array.from({length:n},()=>new Float32Array(4096))}let offset=0;while(offset<x[0].length){const take=Math.min(4096-this.pos,x[0].length-offset);for(let i=0;i<n;i++)this.data[i].set(x[i].subarray(offset,offset+take),this.pos);this.pos+=take;offset+=take;if(this.pos===4096)this.emit()}return true}}registerProcessor("raw-capture",RawCapture)';
   const url=URL.createObjectURL(new Blob([sourceCode],{type:"text/javascript"}));
   try{await ctx.audioWorklet.addModule(url)}finally{URL.revokeObjectURL(url)}
   const node=new AudioWorkletNode(ctx,"raw-capture",{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1]});
   node.port.onmessage=e=>{if(e.data==="flushed"){if(recorder&&recorder.flushed)recorder.flushed()}else if(e.data.blocks)chunk(e.data.blocks)};
   source.connect(node);
   return {node,method:"AudioWorklet",flush:()=>new Promise(resolve=>{if(!recorder)return resolve();recorder.flushed=resolve;node.port.postMessage("flush");setTimeout(resolve,500)})};
  }catch(e){console.warn("AudioWorklet unavailable",e)}
 }
 if(!ctx.createScriptProcessor)throw Error("No browser PCM capture path available.");
 const node=ctx.createScriptProcessor(4096,1,1);
 node.onaudioprocess=e=>{const inp=e.inputBuffer;const arr=[];for(let i=0;i<Math.min(inp.numberOfChannels,2);i++)arr.push(inp.getChannelData(i));chunk(arr);for(let i=0;i<e.outputBuffer.numberOfChannels;i++)e.outputBuffer.getChannelData(i).fill(0)};
 source.connect(node);
 return {node,method:"ScriptProcessor",flush:async()=>{}};
}
function wavEncode(blocks,total,count,rate){
 const buffer=new ArrayBuffer(44+total*count*2),view=new DataView(buffer);
 const string=(at,s)=>{for(let i=0;i<s.length;i++)view.setUint8(at+i,s.charCodeAt(i))};
 string(0,"RIFF");view.setUint32(4,buffer.byteLength-8,true);string(8,"WAVE");
 string(12,"fmt ");view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,count,true);
 view.setUint32(24,rate,true);view.setUint32(28,rate*count*2,true);view.setUint16(32,count*2,true);view.setUint16(34,16,true);
 string(36,"data");view.setUint32(40,total*count*2,true);
 let offset=44;
 for(const block of blocks)for(let i=0;i<block[0].length;i++)for(let ch=0;ch<count;ch++){const x=Math.min(1,Math.max(-1,block[ch][i]));view.setInt16(offset,Math.round(x*(x<0?32768:32767)),true);offset+=2}
 return buffer;
}
function recordingButtons(active){$("startRecord").disabled=active;$("stopRecord").disabled=!active}
async function startCapture(){
 if(recorder)return;
 if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){status("Microphone recording requires HTTPS and microphone permission.",true);return}
 recordingButtons(true);status("Requesting microphone permission…");
 let stream,ctx;
 try{
  stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false,channelCount:{ideal:2}},video:false});
  const track=stream.getAudioTracks()[0],settings=track.getSettings(),Ctx=window.AudioContext||window.webkitAudioContext;
  ctx=new Ctx();await ctx.resume();
  recorder={stream,ctx,track,settings};
  chunks=[];frames=0;channels=0;clips=0;maxPeak=0;startTime=Date.now();
  const src=ctx.createMediaStreamSource(stream),setup=await processor(ctx,src),mute=ctx.createGain();
  mute.gain.value=0;setup.node.connect(mute);mute.connect(ctx.destination);Object.assign(recorder,{src,mute,...setup});
  $("inputLabel").textContent=track.label||"Mic input";
  $("recordSettings").textContent="Input: "+(settings.channelCount||"unknown")+" channel(s); capture "+ctx.sampleRate+" Hz; "+setup.method+". Processing: "+JSON.stringify({echoCancellation:settings.echoCancellation,noiseSuppression:settings.noiseSuppression,autoGainControl:settings.autoGainControl});
  timer=setInterval(()=>{$("recTimer").textContent=time((Date.now()-startTime)/1000);if(Date.now()-startTime>8*60*1000)stopCapture()},250);
  if(navigator.wakeLock){try{wakeLock=await navigator.wakeLock.request("screen")}catch(e){}}
  status(settings.channelCount===1?"Recording MONO. Full PO-35 state is NOT reliably preserved.":"Recording. Press WRITE + SOUND on the PO-35, then stop after transfer.");
 }catch(e){
  status("Cannot start recording: "+e.message,true);
  if(stream)stream.getTracks().forEach(t=>t.stop());
  if(ctx)await ctx.close().catch(()=>{});
  recorder=null;recordingButtons(false);
 }
}
async function stopCapture(){
 if(!recorder)return;
 $("stopRecord").disabled=true;clearInterval(timer);timer=null;
 const r=recorder;
 try{
  await r.flush();
  r.node.disconnect();r.src.disconnect();r.mute.disconnect();r.stream.getTracks().forEach(t=>t.stop());
  await r.ctx.close();
  if(wakeLock){try{await wakeLock.release()}catch(e){}wakeLock=null}
  if(!frames||!channels)throw Error("No samples captured. Check microphone wiring and try again.");
  const blob=new Blob([wavEncode(chunks,frames,channels,r.ctx.sampleRate)],{type:"audio/wav"});
  const filename="PO35-experimental-"+new Date().toISOString().replace(/[:.]/g,"-")+"-"+channels+"ch.wav";
  try{await storeFile({id:crypto.randomUUID(),name:filename,blob,created:Date.now()});status("Stored "+filename+" ("+bytes(blob.size)+"). "+(channels===1?"MONO: not a verified full backup. ":"")+(clips?"Warning: clipping.":"Export to Files for safekeeping."))}
  catch(e){await shareWav(blob,filename);status("Browser storage failed; attempted WAV export. "+e.message,true)}
 }catch(e){status("Recording failed: "+e.message,true)}
 finally{recorder=null;chunks=[];recordingButtons(false);$("meter").style.width="0%"}
}
$("startRecord").addEventListener("click",startCapture);
$("stopRecord").addEventListener("click",stopCapture);
document.addEventListener("visibilitychange",()=>{if(document.hidden&&recorder)status("Warning: browser backgrounded. Audio capture may be incomplete.",true)});
$("showDevices").addEventListener("click",()=>{
 const supported=navigator.mediaDevices?.getSupportedConstraints?.()||{};
 const report={https:window.isSecureContext,microphoneAPI:!!navigator.mediaDevices?.getUserMedia,audioWorklet:!!window.AudioWorkletNode,shareFiles:!!navigator.canShare,requestedConstraints:{echoCancellation:supported.echoCancellation,noiseSuppression:supported.noiseSuppression,autoGainControl:supported.autoGainControl,channelCount:supported.channelCount},liveSettings:recorder?.settings||"Start a capture to inspect actual input"};
 $("diagnostics").textContent=JSON.stringify(report,null,2);
});
if("serviceWorker" in navigator&&location.protocol==="https:")window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(console.warn));
