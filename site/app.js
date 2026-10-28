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
  var uid=0;
  function bind(box){
    var inp=box.querySelector('input'), dd=box.querySelector('.dd'), sel=-1, items=[], lid='dd-'+(++uid);
    // 콤보박스 ARIA: 화살표로 고른 항목을 스크린리더에 알린다
    dd.id=lid; dd.setAttribute('role','listbox'); dd.setAttribute('aria-label','검색 결과');
    inp.setAttribute('role','combobox'); inp.setAttribute('aria-autocomplete','list'); inp.setAttribute('aria-controls',lid); inp.setAttribute('aria-expanded','false');
    function open(on){ dd.classList.toggle('on',on); inp.setAttribute('aria-expanded',on?'true':'false'); if(!on) mark(-1); }
    function mark(i){ sel=i; var as=dd.querySelectorAll('a');
      as.forEach(function(a,j){ a.classList.toggle('sel',j===i); a.setAttribute('aria-selected',j===i?'true':'false'); });
      if(i>=0&&as[i]) inp.setAttribute('aria-activedescendant',as[i].id); else inp.removeAttribute('aria-activedescendant'); }
    function render(list){ items=list;
      if(!inp.value.trim()){ dd.innerHTML=''; open(false); return; }
      if(!list.length){ dd.innerHTML='<div class="none" role="option" aria-disabled="true">검색 결과가 없어요. 다른 단어로 찾아보세요.</div>'; open(true); return; }
      dd.innerHTML=list.map(function(it,i){return '<a id="'+lid+'-'+i+'" role="option" aria-selected="false" href="'+it.u+'"><span>'+esc(it.k)+'</span><span class="cat">'+esc(it.c)+'</span></a>';}).join('');
      open(true); mark(-1); }
    var t; function refresh(){ clearTimeout(t); return load().then(function(){ render(search(inp.value)); }); }
    inp.addEventListener('input',function(){ clearTimeout(t); t=setTimeout(refresh,80); });
    inp.addEventListener('focus',function(){ load(); if(inp.value.trim()) refresh(); });
    inp.addEventListener('keydown',function(e){
      if(e.isComposing||e.keyCode===229) return; // 한글 조합 중 Enter·화살표는 조합 확정에 쓰인다
      var n=dd.querySelectorAll('a').length;
      if(e.key==='ArrowDown'||e.key==='ArrowUp'){
        if(!inp.value.trim()) return;
        e.preventDefault();
        if(!dd.classList.contains('on')){ refresh(); return; } // Esc 로 닫은 뒤 화살표로 다시 연다
        if(!n) return;
        mark(e.key==='ArrowDown' ? (sel+1)%n : (sel<=0 ? n-1 : sel-1));
      }
      else if(e.key==='Enter'){
        if(!inp.value.trim()) return;
        e.preventDefault();
        // 고른 항목이 있으면 그곳으로, 아니면 지금 입력값의 첫 결과로(입력 직후 바로 Enter 해도 동작)
        if(sel>=0&&dd.classList.contains('on')){ location.href=items[sel].u; return; }
        refresh().then(function(){ if(items.length) location.href=items[0].u; });
      }
      else if(e.key==='Escape'){ if(dd.classList.contains('on')){ e.preventDefault(); open(false); } }
    });
    dd.addEventListener('mousemove',function(e){ var a=e.target.closest('a'); if(!a) return; var as=[].slice.call(dd.querySelectorAll('a')); var i=as.indexOf(a); if(i!==sel) mark(i); });
    document.addEventListener('click',function(e){ if(!box.contains(e.target)) open(false); });
  }
  document.querySelectorAll('.srch').forEach(bind);
  // /?q=검색어 딥링크 (schema.org SearchAction) → 히어로 검색창에 채우고 결과 표시
  try{ var q=new URLSearchParams(location.search).get('q'); var big=document.querySelector('.hero .srch input');
    if(q&&big){ big.value=q; big.focus(); big.dispatchEvent(new Event('input')); } }catch(e){}
  document.querySelectorAll('[data-rand]').forEach(function(rb){
    rb.addEventListener('click',function(){ load().then(function(idx){ location.href=idx[Math.floor(Math.random()*idx.length)].u; }); }); });

  // 공유
  var S=window.__SHARE__||{};
  window.shareKakao=function(){
    if(!window.Kakao){alert('잠시 후 다시 시도해 주세요.');return;}
    try{ if(!Kakao.isInitialized()) Kakao.init(S.kakaoKey); }catch(e){}
    Kakao.Share.sendDefault({objectType:'feed',content:{title:S.title,description:S.desc,imageUrl:S.image,imageWidth:1200,imageHeight:630,link:{mobileWebUrl:S.url,webUrl:S.url}},
      buttons:[{title:'해몽 보러 가기',link:{mobileWebUrl:S.url,webUrl:S.url}}]});
  };
  window.shareX=function(){ window.open('https://twitter.com/intent/tweet?text='+encodeURIComponent(S.title+'\n'+S.url),'_blank'); };
  window.shareFB=function(){ window.open('https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(S.url),'_blank'); };
  window.copyLink=function(){ navigator.clipboard.writeText(S.url).then(function(){alert('링크를 복사했어요!');}); };
})();
