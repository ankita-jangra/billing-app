// FAQ accordion
document.querySelectorAll('.faq-item').forEach((item) => {
  const btn = item.querySelector('.faq-question');
  const answer = item.querySelector('.faq-answer');
  if (!btn || !answer) return;

  btn.addEventListener('click', () => {
    const isOpen = item.classList.contains('active');
    document.querySelectorAll('.faq-item').forEach((other) => {
      other.classList.remove('active');
      other.querySelector('.faq-answer').style.maxHeight = null;
    });
    if (!isOpen) {
      item.classList.add('active');
      answer.style.maxHeight = answer.scrollHeight + 'px';
    }
  });
});

// Mobile menu toggle (optional: add .nav-open class to show nav on mobile)
const mobileBtn = document.querySelector('.mobile-menu-btn');
const nav = document.querySelector('.nav');
const headerCta = document.querySelector('.header-cta');

if (mobileBtn && nav) {
  mobileBtn.addEventListener('click', () => {
    nav.classList.toggle('nav-open');
    headerCta?.classList.toggle('nav-open');
    mobileBtn.textContent = nav.classList.contains('nav-open') ? '✕' : '☰';
  });
}

// Feature tabs (optional interaction)
document.querySelectorAll('.feature-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.feature-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
  });
});
