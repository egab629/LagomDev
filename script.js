// Prevent browser scroll restoration on SPA
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.addEventListener('load', function() { window.scrollTo(0, 0); });

function toggleDropdown(el) {
  const item = el.closest('.has-dropdown');
  const isOpen = item.classList.contains('open');
  document.querySelectorAll('.has-dropdown').forEach(d => d.classList.remove('open'));
  if (!isOpen) item.classList.add('open');
}

document.addEventListener('click', function(e) {
  if (!e.target.closest('.has-dropdown')) {
    document.querySelectorAll('.has-dropdown').forEach(d => d.classList.remove('open'));
  }
});

function showPage(id) {
  const target = document.getElementById('page-' + id);
  if (!target) return;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  target.classList.add('active');
  window.scrollTo(0, 0);
}

function toggleMenu() {
  const menu = document.getElementById('mobileMenu');
  menu.classList.toggle('open');
}

function toggleFaq(btn) {
  const item = btn.parentElement;
  const wasOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item').forEach(f => f.classList.remove('open'));
  if (!wasOpen) item.classList.add('open');
}


function submitForm() {
  const name = document.getElementById('cf-name').value.trim();
  const email = document.getElementById('cf-email').value.trim();
  if (!name || !email) { alert('Please fill in your name and email.'); return; }
  document.getElementById('form-success').style.display = 'block';
  document.getElementById('cf-name').value = '';
  document.getElementById('cf-email').value = '';
  document.getElementById('cf-phone').value = '';
  document.getElementById('cf-message').value = '';
}
