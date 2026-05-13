// Prevent browser scroll restoration and anchor jumps on SPA
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.addEventListener('load', function() { window.scrollTo(0, 0); });
document.addEventListener('click', function(e) {
  const a = e.target.closest('a[href="#"]');
  if (a) e.preventDefault();
});

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
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
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

function submitOakdaleForm() {
  const name = document.getElementById('oak-name').value.trim();
  const email = document.getElementById('oak-email').value.trim();
  if (!name || !email) { alert('Please fill in your name and email.'); return; }
  const phone = document.getElementById('oak-phone').value.trim();
  const interest = document.getElementById('oak-interest').value;
  const message = document.getElementById('oak-message').value.trim();
  const subject = encodeURIComponent('Oakdale Forest Inquiry — ' + name);
  const body = encodeURIComponent(
    'Name: ' + name + '\n' +
    'Email: ' + email + '\n' +
    (phone ? 'Phone: ' + phone + '\n' : '') +
    (interest ? 'Interest: ' + interest + '\n' : '') +
    (message ? '\nMessage:\n' + message : '')
  );
  window.location.href = 'mailto:gabby@lagomdevelopment.com?subject=' + subject + '&body=' + body;
  document.getElementById('oak-form-success').style.display = 'block';
  document.getElementById('oak-name').value = '';
  document.getElementById('oak-email').value = '';
  document.getElementById('oak-phone').value = '';
  document.getElementById('oak-interest').value = '';
  document.getElementById('oak-message').value = '';
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
