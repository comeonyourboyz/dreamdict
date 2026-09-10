(function(){
  var IDX=null, loading=null;
  function load(){ if(IDX) return Promise.resolve(IDX); if(loading) return loading;
    loading=fetch('/search-index.json').then(function(r){return r.json();}).then(function(j){IDX=j;return j;}); return loading; }
  // 한글 초성 추출
  var CHO=['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  function cho(s){ var o=''; for(var i=0;i<s.length;i++){ var c=s.charCodeAt(i); if(c>=0xAC00&&c<=0xD7A3) o+=CHO[Math.floor((c-0xAC00)/588)]; else o+=s[i]; } return o; }
  var norm=function(s){return s.replace(/\s+/g,'').toLowerCase();};
  var isCho=function(q){return /^[ㄱ-ㅎ]+$/.test(q);};
  function search(q){
    q=norm(q); if(!q) return [];
    var out=[], seen={};
    for(var i=0;i<IDX.length;i++){
      var it=IDX[i], score=0, kw=norm(it.k);
      if(kw.indexOf(q)===0) score=3; else if(kw.indexOf(q)>-1) score=2;
      else if(isCho(q) && cho(kw).indexOf(q)>-1) score=1.5;
      else { for(var j=0;j<it.s.length;j++){ if(norm(it.s[j]).indexOf(q)>-1){score=1;break;} } }
      if(score){ out.push([score,it]); }
    }
    out.sort(function(a,b){return b[0]-a[0]||a[1].k.localeCompare(b[1].k,'ko');});
    return out.slice(0,8).map(function(x){return x[1];});
  }
  function esc(s){return s.replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function bind(box){
    var inp=box.querySelector('input'), dd=box.querySelector('.dd'), sel=-1, items=[];
    function render(list){ items=list; sel=-1;
      if(!inp.value.trim()){dd.classList.remove('on');return;}
      if(!list.length){ dd.innerHTML='<div class="none">검색 결과가 없어요. 다른 단어로 찾아보세요.</div>'; dd.classList.add('on'); return; }
      dd.innerHTML=list.map(function(it){return '<a href="'+it.u+'"><span>'+esc(it.k)+'</span><span class="cat">'+esc(it.c)+'</span></a>';}).join('');
      dd.classList.add('on'); }
    var t; inp.addEventListener('input',function(){ clearTimeout(t); t=setTimeout(function(){ load().then(function(){render(search(inp.value));}); },80); });
    inp.addEventListener('focus',function(){ load(); if(inp.value.trim()) render(search(inp.value)); });
    inp.addEventListener('keydown',function(e){
      var as=dd.querySelectorAll('a');
      if(e.key==='ArrowDown'){ e.preventDefault(); sel=Math.min(sel+1,as.length-1); }
      else if(e.key==='ArrowUp'){ e.preventDefault(); sel=Math.max(sel-1,0); }
      else if(e.key==='Enter'){ if(as.length){ location.href=(as[sel>=0?sel:0]).href; } return; }
      else if(e.key==='Escape'){ dd.classList.remove('on'); return; } else return;
      as.forEach(function(a,i){a.classList.toggle('sel',i===sel);});
    });
    document.addEventListener('click',function(e){ if(!box.contains(e.target)) dd.classList.remove('on'); });
  }
  document.querySelectorAll('.srch').forEach(bind);
  var rb=document.getElementById('randBtn');
  if(rb) rb.addEventListener('click',function(){ load().then(function(idx){ location.href=idx[Math.floor(Math.random()*idx.length)].u; }); });

  // 공유
  var S=window.__SHARE__||{};
  window.shareKakao=function(){
    if(!window.Kakao){alert('잠시 후 다시 시도해 주세요.');return;}
    try{ if(!Kakao.isInitialized()) Kakao.init(S.kakaoKey); }catch(e){}
    Kakao.Share.sendDefault({objectType:'feed',content:{title:S.title,description:S.desc,imageUrl:S.image,imageWidth:800,imageHeight:400,link:{mobileWebUrl:S.url,webUrl:S.url}},
      buttons:[{title:'해몽 보러 가기',link:{mobileWebUrl:S.url,webUrl:S.url}}]});
  };
  window.shareX=function(){ window.open('https://twitter.com/intent/tweet?text='+encodeURIComponent(S.title+'\n'+S.url),'_blank'); };
  window.shareFB=function(){ window.open('https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(S.url),'_blank'); };
  window.copyLink=function(){ navigator.clipboard.writeText(S.url).then(function(){alert('링크를 복사했어요!');}); };
})();
