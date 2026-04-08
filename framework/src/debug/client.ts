export function getDebugBarScript(fragmentIds: string[]): string {
  return `<script>(function(){
var ids=${JSON.stringify(fragmentIds)};
var el=document.createElement('div');
el.id='__debug-bar';
el.innerHTML='<button id="__dbg-toggle" style="position:fixed;bottom:12px;right:12px;z-index:999999;background:#1a1a2e;color:#fff;border:none;border-radius:6px;padding:6px 12px;font:12px/1.4 monospace;cursor:pointer;opacity:0.8">Debug</button><div id="__dbg-panel" style="display:none;position:fixed;bottom:48px;right:12px;z-index:999999;background:#1a1a2e;color:#e0e0e0;border-radius:8px;padding:16px;font:12px/1.6 monospace;width:480px;max-height:70vh;overflow-y:auto;box-shadow:0 4px 24px rgba(0,0,0,.4)"><h3 style="margin:0 0 12px;font-size:14px;color:#fff">Stream Debug</h3><div id="__dbg-waterfall"></div><div style="margin-top:12px;border-top:1px solid #333;padding-top:12px"><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="__dbg-nocache"><span style="color:#aaa;font-size:12px">Disable cache</span></label></div><div style="margin-top:12px"><button id="__dbg-disable" style="background:#f44336;color:#fff;border:none;border-radius:4px;padding:4px 12px;font:12px monospace;cursor:pointer">Disable Debug</button></div></div>';
document.body.appendChild(el);

var toggle=document.getElementById('__dbg-toggle');
var panel=document.getElementById('__dbg-panel');
toggle.onclick=function(){panel.style.display=panel.style.display==='none'?'block':'none'};

// Read debug data from data-attributes on fragment divs
var frags={};
ids.forEach(function(id){
  var node=document.querySelector('[data-fragment="'+id+'"]');
  if(!node)return;
  frags[id]={
    cached:node.getAttribute('data-dbg-cached')==='true',
    serverStart:parseFloat(node.getAttribute('data-dbg-start'))||0,
    serverEnd:parseFloat(node.getAttribute('data-dbg-end'))||0
  };
});

// Waterfall
var wf=document.getElementById('__dbg-waterfall');
var maxT=0;
ids.forEach(function(id){var f=frags[id];if(f&&f.serverEnd>maxT)maxT=f.serverEnd});
maxT=Math.max(maxT,100);

ids.forEach(function(id){
  var f=frags[id]||{};
  var cached=f.cached;
  var color=cached?'#4CAF50':'#2196F3';
  var badge=cached?'HIT':'MISS';
  var badgeColor=cached?'#4CAF50':'#ff9800';
  var startPct=((f.serverStart||0)/maxT*100);
  var widthPct=Math.max(((f.serverEnd||0)-(f.serverStart||0))/maxT*100,2);
  var duration=f.serverEnd?Math.round(f.serverEnd-(f.serverStart||0))+'ms':'?';
  var row=document.createElement('div');
  row.style.cssText='display:flex;align-items:center;margin:4px 0;gap:8px';
  var nameSpan=document.createElement('span');
  nameSpan.style.cssText='width:80px;text-align:right;color:#aaa;flex-shrink:0;cursor:pointer;position:relative';
  nameSpan.textContent=id;
  var tooltip=document.createElement('div');
  tooltip.style.cssText='display:none;position:absolute;bottom:120%;right:0;background:#2a2a3e;color:#e0e0e0;border:1px solid #444;border-radius:4px;padding:6px 10px;font-size:11px;white-space:nowrap;z-index:1000000;pointer-events:none';
  tooltip.innerHTML='<b>'+id+'</b><br>Cache: <span style="color:'+badgeColor+'">'+badge+'</span><br>Time: '+duration;
  nameSpan.appendChild(tooltip);
  nameSpan.onmouseenter=function(){tooltip.style.display='block'};
  nameSpan.onmouseleave=function(){tooltip.style.display='none'};
  row.appendChild(nameSpan);
  row.innerHTML+='<div style="flex:1;height:18px;background:#2a2a3e;border-radius:3px;position:relative;overflow:hidden"><div style="position:absolute;left:'+startPct+'%;width:'+widthPct+'%;height:100%;background:'+color+';border-radius:3px;min-width:4px"></div></div><span style="color:'+badgeColor+';width:36px;font-size:10px;flex-shrink:0">'+badge+'</span><span style="color:#888;width:50px;font-size:10px;flex-shrink:0">'+duration+'</span>';
  wf.appendChild(row);
});

// No-cache checkbox
var nocache=document.getElementById('__dbg-nocache');
nocache.checked=document.cookie.indexOf('__debug_nocache=1')!==-1;
nocache.onchange=function(){
  if(this.checked){document.cookie='__debug_nocache=1;path=/'}
  else{document.cookie='__debug_nocache=;max-age=0;path=/'}
  location.reload();
};

document.getElementById('__dbg-disable').onclick=function(){
  document.cookie='__debug=;max-age=0;path=/';
  document.cookie='__debug_nocache=;max-age=0;path=/';
  location.reload();
};
})()</script>`;
}
