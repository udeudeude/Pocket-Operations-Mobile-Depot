"use strict";
/* PO-35 controlled-transfer inspector.
   Deliberately no decoding or resampling of the original audio. */
function inspectWav(buf) {
 const d=new DataView(buf), size=d.byteLength;
 if(size<44)throw Error("Truncated or non-WAV file");
 const four=at=>String.fromCharCode(d.getUint8(at),d.getUint8(at+1),d.getUint8(at+2),d.getUint8(at+3));
 if(four(0)!=="RIFF"||four(8)!=="WAVE")throw Error("This is not a RIFF/WAVE file");
 let p=12,fmt=null,audio=null;
 while(p+8<=size) {
  const tag=four(p),len=d.getUint32(p+4,true),offset=p+8,finish=offset+len;
  if(tag==="fmt "){
   if(len<16||finish>size)throw Error("Invalid WAV format header");
   const encoding=d.getUint16(offset,true),channels=d.getUint16(offset+2,true),sampleRate=d.getUint32(offset+4,true);
   const blockAlign=d.getUint16(offset+12,true),bits=d.getUint16(offset+14,true);
   let codec=encoding;
   if(encoding===65534 && len>=40)codec=d.getUint16(offset+24,true);
   fmt={encoding,codec,channels,sampleRate,blockAlign,bits};
  }
  if(tag==="data"){
   audio={offset,declaredBytes:len,actualBytes:Math.max(0,Math.min(len,size-offset)),truncated:finish>size};
   break;
  }
  if(finish>size)throw Error("Truncated WAV chunk: "+tag);
  p=finish+(len%2);
 }
 if(!fmt||!audio)throw Error("Missing WAV audio or format chunk");
 const f=fmt;
 if(f.channels<1||f.channels>8||!f.sampleRate||!f.blockAlign)throw Error("Invalid WAV channel/rate layout");
 if(!((f.codec===1&&[8,16,24,32].includes(f.bits))||(f.codec===3&&[32,64].includes(f.bits))))
  throw Error("Only PCM integer or IEEE-float WAV can be inspected (codec "+f.codec+", "+f.bits+"-bit)");
 if(f.blockAlign<f.channels*(f.bits/8))throw Error("Invalid WAV block alignment");
 const frames=Math.floor(audio.actualBytes/f.blockAlign);
 if(!frames)throw Error("WAV has no playable sample frames");
 const stride=Math.max(1,Math.ceil(frames/250000)),mins=new Array(f.channels).fill(1),maxs=new Array(f.channels).fill(-1),squares=new Array(f.channels).fill(0),counts=new Array(f.channels).fill(0);
 const clip=new Array(f.channels).fill(0);
 let pairs=0,xy=0,ll=0,rr=0,diff=0,matched=0,active=0;
 const read=(pos)=>{
  if(f.codec===3)return f.bits===32?d.getFloat32(pos,true):d.getFloat64(pos,true);
  if(f.bits===8)return (d.getUint8(pos)-128)/128;
  if(f.bits===16)return d.getInt16(pos,true)/32768;
  if(f.bits===24){let n=d.getUint8(pos)|(d.getUint8(pos+1)<<8)|(d.getUint8(pos+2)<<16);if(n&8388608)n-=16777216;return n/8388608}
  return d.getInt32(pos,true)/2147483648;
 };
 for(let frame=0;frame<frames;frame+=stride){
  const base=audio.offset+frame*f.blockAlign, vals=[];
  for(let ch=0;ch<f.channels;ch++){
   const x=read(base+ch*f.bits/8);vals.push(x);
   if(!Number.isFinite(x))continue;
   mins[ch]=Math.min(mins[ch],x);maxs[ch]=Math.max(maxs[ch],x);
   squares[ch]+=x*x;counts[ch]++;
   if(Math.abs(x)>=0.999)clip[ch]++;
   if(Math.abs(x)>0.01)active++;
  }
  if(f.channels===2&&Number.isFinite(vals[0])&&Number.isFinite(vals[1])){
   const a=vals[0],b=vals[1];pairs++;xy+=a*b;ll+=a*a;rr+=b*b;diff+=(a-b)*(a-b);if(a===b)matched++;
  }
 }
 const sampledFrames=Math.ceil(frames/stride);
 const perChannel=counts.map((n,ch)=>({number:ch+1,peak:Math.max(Math.abs(mins[ch]),Math.abs(maxs[ch])),rms:n?Math.sqrt(squares[ch]/n):0,clippedSampled:clip[ch],sampled:n}));
 const exactShare=pairs?matched/pairs:null;
 const relativeStereoDiff=pairs&&ll+rr>0?diff/(ll+rr):null;
 const correlation=pairs&&ll&&rr?xy/Math.sqrt(ll*rr):null;
 const warnings=[];
 if(f.channels!==2)warnings.push("Not stereo. Do not trust this as a complete PO-35 backup.");
 if(f.sampleRate<44100||f.bits<16)warnings.push("Below the PO-35's 16-bit / 44.1 kHz minimum.");
 if(f.codec!==1)warnings.push("Float WAV may be fine for study, but original 16/24-bit PCM is preferred for archival transfer.");
 if(audio.truncated||audio.declaredBytes%f.blockAlign!==0)warnings.push("Truncated or incomplete WAV audio data.");
 if(clip.some(x=>x>0))warnings.push("Possible clipping detected in sampled frames.");
 if(f.channels===2&&exactShare!==null&&exactShare>0.9999)warnings.push("Stereo channels appear identical. Confirm this was a genuine stereo capture, not duplicated mono.");
 if(counts.some(x=>x!==sampledFrames))warnings.push("Non-finite audio values encountered.");
 return {container:"RIFF/WAVE",codec:f.codec===1?"PCM":"IEEE float",channels:f.channels,sampleRate:f.sampleRate,bitsPerSample:f.bits,
  blockAlign:f.blockAlign,durationSeconds:frames/f.sampleRate,frames,bytesOfAudio:audio.actualBytes,
  scanStride:stride,scanSampledFrames:sampledFrames,perChannel,
  stereo:{correlation,identicalFraction:exactShare,relativeDifferenceEnergy:relativeStereoDiff},
  warnings,inspectionOnly:true};
}
function setupResearch(){
 const ids=["A","B","C"],cases={A:"unchanged-baseline-1",B:"unchanged-baseline-2",C:"single-step-change"},results={A:null,B:null,C:null};
 const $=id=>document.getElementById(id);
 const percent=x=>(x*100).toFixed(1)+"%";
 function output(id,entry){
  const el=$("researchResult"+id);el.textContent="";
  if(entry.error){el.textContent="Error: "+entry.error;return}
  const a=entry.audio,m=a.perChannel;
  const lines=[
   entry.name+" · "+(entry.size/1048576).toFixed(1)+" MiB",
   a.channels+" channels · "+a.sampleRate+" Hz · "+a.bitsPerSample+"-bit "+a.codec+" · "+a.durationSeconds.toFixed(2)+" s",
   m.map(x=>"Ch"+x.number+" peak "+percent(x.peak)+", RMS "+percent(x.rms)).join(" | "),
   "Sampled clipping events: "+m.reduce((n,x)=>n+x.clippedSampled,0)+" (stride "+a.scanStride+")",
   a.channels===2?"Channel similarity: "+(a.stereo.identicalFraction*100).toFixed(2)+"% identical frames (sampled)":"Stereo comparison unavailable",
   "SHA-256: "+entry.sha256
  ];
  if(a.warnings.length)lines.push("WARN: "+a.warnings.join(" | "));
  else lines.push("WAV structure looks suitable for further investigation. Transfer data has NOT been validated.");
  el.textContent=lines.join("\n");
  $("researchStatus"+id).textContent=a.warnings.length?"Review":"Inspected";
  $("researchExport").disabled=false;
 }
 async function choose(id,file){
  if(!file)return;
  $("researchStatus"+id).textContent="Inspecting…";
  $("researchResult"+id).textContent="Checking file header, sampled audio and whole-file fingerprint…";
  // Release the preceding buffer immediately rather than keeping large captures in memory.
  results[id]=null;
  try {
   const buffer=await file.arrayBuffer(),audio=inspectWav(buffer);
   let sha256="unavailable";
   if(crypto.subtle?.digest) {
    const raw=new Uint8Array(await crypto.subtle.digest("SHA-256",buffer));
    sha256=Array.from(raw,x=>x.toString(16).padStart(2,"0")).join("");
   }
   const entry={case:cases[id],name:file.name,size:file.size,sha256,audio};
   results[id]=entry;
   output(id,entry);
  }catch(e){
   const entry={case:cases[id],name:file.name,size:file.size,error:String(e?.message||e)};
   results[id]=entry;
   $("researchStatus"+id).textContent="Invalid";
   output(id,entry);
  }
  const count=ids.filter(k=>results[k]&&results[k].audio).length;
  const same=results.A?.sha256&&results.B?.sha256&&results.A.sha256===results.B.sha256;
  const issues=[];
  if(same)issues.push("Baseline A and B have exactly the same file fingerprint. Check for accidental reuse of one recording.");
  const imported=ids.filter(k=>results[k]).length;
  if(imported<3)issues.push("Import all three WAV files for the full controlled experiment.");
  const msg=count+" valid WAV(s) inspected. "+issues.join(" ");
  $("researchSummary").textContent=msg;
  $("researchExport").disabled=imported===0;
 }
 ids.forEach(id=>$("researchFile"+id).addEventListener("change",async ev=>{
  const f=ev.target.files[0];ev.target.value="";await choose(id,f);
 }));
 $("researchExport").addEventListener("click",()=>{
  if(!ids.some(id=>results[id]))return;
  const manifest={
   manifestVersion:1,kind:"PO-35 controlled backup comparison",
   createdAt:new Date().toISOString(),
   warning:"This manifest is metadata only. Original WAV audio files are not included and have not been decoded or validated for PO-35 restore.",
   protocol:"Two successive unchanged full-state transfers, then one transfer after one sequencer-step modification.",
   singleStepChange:$("researchChange").value.trim(),
   recordingNotes:$("researchNotes").value.trim(),
   files:ids.map(id=>results[id]||{case:cases[id],status:"not provided"}),
   interpretationNotes:["The SHA-256 value identifies the exact WAV file bytes, not the decoded PO-35 payload.","Waveform similarity or channel correlation does not establish backup equivalence.","Warnings are diagnostics, not evidence of a valid transfer."]
  };
  const raw=JSON.stringify(manifest,null,2),blob=new Blob([raw],{type:"application/json"}),url=URL.createObjectURL(blob);
  const link=document.createElement("a");link.href=url;link.download="PO35-research-"+new Date().toISOString().slice(0,10)+".json";
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
 });
}
if(typeof document!=="undefined"&&document.getElementById("researchExport"))setupResearch();
