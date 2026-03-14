(function(){
  var cards = document.querySelectorAll('.flip-card');
  cards.forEach(function(card){
    card.addEventListener('click', function(){
      card.classList.toggle('is-flipped');
    });
    card.addEventListener('keypress', function(e){
      if(e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        card.classList.toggle('is-flipped');
      }
    });
  });

  var events = document.querySelectorAll('.t-event');
  var progress = document.getElementById('timelineProgress');
  if(events.length && progress){
    var idx = 0;
    function paint(i){
      events.forEach(function(ev, n){ ev.classList.toggle('active', n <= i); });
      var pct = (i/(events.length-1))*100;
      progress.style.width = pct + '%';
    }
    paint(0);
    var timer = setInterval(function(){
      idx += 1;
      paint(idx);
      if(idx >= events.length - 1){ clearInterval(timer); }
    }, 900);
  }
  var tree = document.getElementById('scaleTreeSvg');
  if(tree){
    var seq = [
      '.root-line,.n0,.i0',
      '.branch-line',
      '.d1,.n1,.i1',
      '.d2,.n2,.i2',
      '.d3,.n3,.i3',
      '.d4,.n4,.i4'
    ];
    var step = -1;
    function resetTree(){
      tree.querySelectorAll('.on').forEach(function(el){ el.classList.remove('on'); });
    }
    function tickTree(){
      if(step >= seq.length - 1){
        step = -1;
        resetTree();
      }
      step += 1;
      tree.querySelectorAll(seq[step]).forEach(function(el){ el.classList.add('on'); });
    }
    resetTree();
    setInterval(tickTree, 650);
  }
})();
