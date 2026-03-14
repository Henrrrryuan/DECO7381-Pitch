(function(){
  // Smooth scroll for in-page nav links
  document.querySelectorAll('a[href^="#"]').forEach(function(anchor){
    anchor.addEventListener('click', function(e){
      var target = document.querySelector(this.getAttribute('href'));
      if(target){
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });

        // update active state on sidebar links
        document.querySelectorAll('.sidebar-left nav ul li a').forEach(function(link){
          link.classList.remove('active');
        });
        this.classList.add('active');
      }
    });
  });

  // Highlight sidebar item based on scroll position
  var sections = document.querySelectorAll('#problem-bci, #design-bci, #plan-bci, #qa-bci');
  var navLinks = document.querySelectorAll('.sidebar-left nav ul li a');

  function syncActiveOnScroll() {
    var currentId = null;
    var scrollPos = window.pageYOffset || document.documentElement.scrollTop;

    sections.forEach(function(sec){
      var rect = sec.getBoundingClientRect();
      var offsetTop = rect.top + scrollPos;
      if (scrollPos >= offsetTop - 140) {
        currentId = sec.id;
      }
    });

    if(currentId){
      navLinks.forEach(function(link){
        link.classList.remove('active');
        if(link.getAttribute('href') === '#' + currentId){
          link.classList.add('active');
        }
      });
    }
  }

  window.addEventListener('scroll', syncActiveOnScroll);
  syncActiveOnScroll();

  // Flip-card interaction
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

  // Timeline auto-play
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
  // Scalability tree animation
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
