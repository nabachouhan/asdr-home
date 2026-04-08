/* ============================================================
   ASSAM SDR — Home Page Animations
   Counter-up, Scroll Reveal, Navbar Scroll Effect
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ============================================
  // 1. NAVBAR SCROLL EFFECT
  // ============================================
  const navbar = document.querySelector('.sdr-navbar');
  if (navbar) {
    const handleScroll = () => {
      if (window.scrollY > 60) {
        navbar.classList.add('nav-scrolled');
      } else {
        navbar.classList.remove('nav-scrolled');
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // run on load
  }

  // ============================================
  // 2. MOBILE NAV TOGGLE
  // ============================================
  const mobileToggle = document.querySelector('.mobile-toggle');
  const navLinks = document.querySelector('.sdr-navbar .nav-links');
  if (mobileToggle && navLinks) {
    mobileToggle.addEventListener('click', () => {
      navLinks.classList.toggle('mobile-open');
      mobileToggle.classList.toggle('active');
    });

    // Close on link click
    navLinks.querySelectorAll('.nav-link-item').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('mobile-open');
        mobileToggle.classList.remove('active');
      });
    });
  }

  // ============================================
  // 3. COUNTER-UP ANIMATION
  // ============================================
  const animateCounter = (el) => {
    const target = parseInt(el.getAttribute('data-target'), 10);
    if (isNaN(target)) return;

    const duration = 2000;
    const start = performance.now();
    const startVal = 0;

    const easeOutQuart = t => 1 - Math.pow(1 - t, 4);

    const update = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutQuart(progress);
      const current = Math.round(startVal + (target - startVal) * easedProgress);

      el.textContent = current.toLocaleString();

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    };

    requestAnimationFrame(update);
  };

  // ============================================
  // 4. SCROLL REVEAL (IntersectionObserver)
  // ============================================
  const revealElements = document.querySelectorAll('.reveal');
  const counterElements = document.querySelectorAll('.counter-up');
  const counterAnimated = new Set();

  const observerOptions = {
    threshold: 0.15,
    rootMargin: '0px 0px -40px 0px'
  };

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        revealObserver.unobserve(entry.target);
      }
    });
  }, observerOptions);

  revealElements.forEach(el => revealObserver.observe(el));

  // Counter observer
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !counterAnimated.has(entry.target)) {
        counterAnimated.add(entry.target);
        animateCounter(entry.target);
        counterObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  counterElements.forEach(el => counterObserver.observe(el));

  // ============================================
  // 5. SMOOTH SCROLL FOR ANCHOR LINKS
  // ============================================
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      const targetEl = document.querySelector(targetId);
      if (targetEl) {
        e.preventDefault();
        targetEl.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  // ============================================
  // 6. ACTIVE NAV LINK HIGHLIGHT ON SCROLL
  // ============================================
  const sections = document.querySelectorAll('section[id], div[id]');
  const navLinkItems = document.querySelectorAll('.sdr-navbar .nav-link-item');

  const highlightNav = () => {
    let scrollPos = window.scrollY + 200;

    sections.forEach(section => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      const id = section.getAttribute('id');

      if (scrollPos >= top && scrollPos < top + height) {
        navLinkItems.forEach(link => {
          link.classList.remove('active');
          const href = link.getAttribute('href');
          if (href === `/#${id}` || href === `#${id}` || (id === 'home' && href === '/')) {
            link.classList.add('active');
          }
        });
      }
    });
  };

  window.addEventListener('scroll', highlightNav, { passive: true });

});
