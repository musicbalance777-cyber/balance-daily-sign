'use strict';
const notes = [
  'Не всі прекрасні речі потребують особливого приводу. Іноді достатньо просто помітити їх.',
  'Ти можеш мати великі плани й водночас насолоджуватися маленькими моментами.',
  'Можливо, сьогодні найкращий план — залишити трохи місця для несподіваного.',
  'Не кожен день має бути продуктивним, щоб бути вартим уваги.',
  'У житті завжди знайдеться місце для ще однієї гарної історії.',
  'Твоя наступна улюблена мить може виявитися зовсім звичайною.',
  'Іноді зміна перспективи починається з прогулянки й хорошої музики.',
  'Дозволь собі бути людиною, яка цінує і спокій, і великі амбіції.',
  'Краса буденності в тому, що вона ніколи не повторюється точно.'
];
const edition = document.getElementById('edition');
const message = document.getElementById('message');
const messageText = document.getElementById('message-text');
const messageIndex = document.getElementById('message-index');
let last = -1;
edition.addEventListener('change', () => { document.body.dataset.edition = edition.value; });
document.body.dataset.edition = edition.value;
document.querySelectorAll('[data-card]').forEach(card => {
  card.addEventListener('click', () => {
    let next = Math.floor(Math.random() * notes.length);
    if (notes.length > 1 && next === last) next = (next + 1) % notes.length;
    last = next;
    messageText.textContent = notes[next];
    messageIndex.textContent = `NOTE 0${Number(card.dataset.card) + 1}`;
    message.hidden = false;
    message.style.animation = 'none';
    void message.offsetWidth;
    message.style.animation = '';
    message.scrollIntoView({behavior:'smooth',block:'center'});
  });
});
document.getElementById('again').addEventListener('click', () => {
  message.hidden = true;
  document.querySelector('.cards').scrollIntoView({behavior:'smooth',block:'center'});
});
