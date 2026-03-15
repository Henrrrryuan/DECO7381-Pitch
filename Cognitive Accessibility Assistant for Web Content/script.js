// 平滑滚动
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// 导航栏滚动激活
const sections = document.querySelectorAll('section');
const navLinks = document.querySelectorAll('.sidebar-left nav ul li a');

window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        if (window.pageYOffset >= (sectionTop - 150)) {
            current = section.getAttribute('id');
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active');
        }
    });
});

// Core Modules dashboard: Before / After toggle
const viewButtons = document.querySelectorAll('.view-toggle-btn');
const riskRows = document.querySelectorAll('.risk-row');

viewButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view');
        viewButtons.forEach(b => b.classList.toggle('is-active', b === btn));

        riskRows.forEach(row => {
            const fill = row.querySelector('.risk-fill');
            const badge = row.querySelector('.risk-badge');
            if (!fill || !badge) return;
            const widthAttr = view === 'before' ? 'data-before-width' : 'data-after-width';
            const labelAttr = view === 'before' ? 'data-before-label' : 'data-after-label';
            const newWidth = fill.getAttribute(widthAttr) || '50';
            const newLabel = badge.getAttribute(labelAttr) || '';
            fill.style.width = `${newWidth}%`;
            badge.textContent = newLabel;
        });
    });
});

// Core Modules dashboard: Insight tabs
const insightTabs = document.querySelectorAll('.insight-tab');
const insightBodies = document.querySelectorAll('.insight-body');

insightTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const target = tab.getAttribute('data-insight-target');
        insightTabs.forEach(t => t.classList.toggle('is-active', t === tab));
        insightBodies.forEach(body => {
            body.classList.toggle('is-active', body.getAttribute('data-insight') === target);
        });
    });
});

// Reference 链接弹窗：点击卡片在当前页弹出小窗口，不离开 111.html
(function () {
    const overlay = document.getElementById('ref-modal');
    const iframe = document.getElementById('ref-modal-iframe');
    const titleEl = document.getElementById('ref-modal-title');
    const openNewLink = document.getElementById('ref-modal-open-new');
    const closeBtn = overlay && overlay.querySelector('.ref-modal-close');

    function openModal(url, title) {
        if (!overlay || !iframe) return;
        iframe.src = url;
        if (titleEl) titleEl.textContent = title || 'Reference';
        if (openNewLink) {
            openNewLink.href = url;
            openNewLink.setAttribute('href', url);
        }
        overlay.classList.add('is-open');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        if (!overlay) return;
        overlay.classList.remove('is-open');
        overlay.setAttribute('aria-hidden', 'true');
        if (iframe) iframe.src = 'about:blank';
        document.body.style.overflow = '';
    }

    document.querySelectorAll('.ref-modal-trigger').forEach(trigger => {
        trigger.addEventListener('click', function (e) {
            e.preventDefault();
            const url = this.getAttribute('data-ref-url') || this.getAttribute('href');
            const title = this.getAttribute('data-ref-title') || '';
            if (url) openModal(url, title);
        });
    });

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (overlay) {
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closeModal();
        });
    }
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && overlay && overlay.classList.contains('is-open')) closeModal();
    });
})();