// Renders the app icon set in assets/ from the in-app drop-and-peak mark (same paths as DROP_PATH and
// PEAK_PATH in src/art/svg.ts). Needs Microsoft Edge. Usage: node tools/make-icons.cjs .
const path=require('path'),fs=require('fs');const root=process.argv[2];
const {chromium}=require(path.join(root,'node_modules/@playwright/test'));
const DROP='M18 2 C28 16 34 24 34 32 a16 16 0 0 1 -32 0 C2 24 8 16 18 2 Z';
const PEAK='M6.5 25.5 H12 L15.6 17.6 Q18 12.6 20.4 17.6 L24 25.5 H29.5';
const MINT='#91E6B2',INK='#101412';
// The mark occupies x 2..34, y 2..48 on its grid (the drop's round base extends to y=48).
function mark(size,frac,fill,peak){const h=size*frac,s=h/46,w=32*s;const ox=(size-w)/2-2*s,oy=(size-h)/2-2*s;
 return `<g transform="translate(${ox},${oy}) scale(${s})"><path d="${DROP}" fill="${fill}"/>`+(peak?`<path d="${PEAK}" fill="none" stroke="${peak}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`:'')+`</g>`}
function monoMark(size,frac){ // single colour: the peak is cut out of the drop
 const h=size*frac,s=h/46,w=32*s;const ox=(size-w)/2-2*s,oy=(size-h)/2-2*s;
 return `<defs><mask id="m"><rect width="${size}" height="${size}" fill="black"/><g transform="translate(${ox},${oy}) scale(${s})"><path d="${DROP}" fill="white"/><path d="${PEAK}" fill="none" stroke="black" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></g></mask></defs><rect width="${size}" height="${size}" fill="white" mask="url(#m)"/>`}
const svg=(size,body,bg)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${bg?`<rect width="${size}" height="${size}" fill="${bg}"/>`:''}${body}</svg>`;
const out=[
 ['icon.png',1024,svg(1024,mark(1024,0.60,MINT,INK),INK),false],
 ['favicon.png',48,svg(48,mark(48,0.80,MINT,INK),INK),false],
 ['android-icon-foreground.png',512,svg(512,mark(512,0.42,MINT,INK)),true],   // inside the 66/108 safe zone
 ['android-icon-background.png',512,svg(512,'',INK),false],
 ['android-icon-monochrome.png',432,svg(432,monoMark(432,0.42)),true],
 ['splash-icon.png',1024,svg(1024,mark(1024,0.50,MINT,INK)),true],
];
(async()=>{const b=await chromium.launch({channel:'msedge'});
 for(const [name,size,s,transparent] of out){const p=await b.newPage({viewport:{width:size,height:size},deviceScaleFactor:1});
  await p.setContent(`<html><body style="margin:0;background:transparent">${s}</body></html>`);
  await p.screenshot({path:path.join(root,'assets',name),omitBackground:transparent,clip:{x:0,y:0,width:size,height:size}});await p.close();console.log(name,size)}
 await b.close()})();
