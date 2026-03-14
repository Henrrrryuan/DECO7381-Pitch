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