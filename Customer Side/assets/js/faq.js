(function () {

    var inPages = /\/pages\/[^/]*$/.test(location.pathname);
    var contactsUrl = inPages ? 'contacts.html' : 'pages/contacts.html';
    var menuUrl = inPages ? 'menu.html' : 'pages/menu.html';
    var eventsUrl = inPages ? 'events.html' : 'pages/events.html';

    var faqs = [
        {
            q: 'Where is The 70\'s Bistro located?',
            a: '46 Anonas St., Quirino 2-3, Quezon City, Philippines, 1102. ' +
                '<a href="https://www.google.com/maps/search/?api=1&query=The+70s+Bistro+bar+46+Anonas+St+Quezon+City" target="_blank" rel="noopener">Open in Google Maps</a>.'
        },
        {
            q: 'How can I reserve a table?',
            a: 'Use the "Reserve a Table" button on the home page, or reach us through the <a href="' + contactsUrl + '">Contacts</a> page.'
        },
        {
            q: 'Can I see the menu before I visit?',
            a: 'Yes. Browse our food, drinks and cocktails on the <a href="' + menuUrl + '">Menu</a> page.'
        },
        {
            q: 'Do you have live music or events?',
            a: 'We host live music and bistro sessions. Check the <a href="' + eventsUrl + '">Events</a> page for what\'s coming up.'
        },
        {
            q: 'How can my band book a gig?',
            a: 'Bands and performers can get in touch through the <a href="' + contactsUrl + '">Contacts</a> page to ask about playing the room.'
        },
        {
            q: 'How do I contact the bistro?',
            a: 'Call (63+) 956 081 3236 or email <a href="mailto:the70sbistrobar@gmail.com">the70sbistrobar@gmail.com</a>. You can also message us on Facebook, Instagram or TikTok.'
        }
    ];

    var widget = document.createElement('div');
    widget.className = 'faq-widget';
    widget.innerHTML =
        '<div class="faq-panel" id="faqPanel" role="dialog" aria-label="Frequently asked questions">' +
            '<div class="faq-header"><span>NEED HELP?</span><h2>Frequently Asked Questions</h2></div>' +
            '<div class="faq-list">' +
                faqs.map(function (f, i) {
                    return '<div class="faq-item">' +
                        '<button class="faq-question" type="button" aria-expanded="false" aria-controls="faqA' + i + '">' +
                            '<span>' + f.q + '</span><i class="fa-solid fa-chevron-down" aria-hidden="true"></i>' +
                        '</button>' +
                        '<div class="faq-answer" id="faqA' + i + '">' + f.a + '</div>' +
                    '</div>';
                }).join('') +
            '</div>' +
        '</div>' +
        '<button class="faq-bubble" type="button" aria-label="Open FAQ" aria-expanded="false" aria-controls="faqPanel">' +
            '<i class="fa-solid fa-question" aria-hidden="true"></i>' +
        '</button>';
    document.body.appendChild(widget);

    var bubble = widget.querySelector('.faq-bubble');
    var icon = bubble.querySelector('i');

    function setOpen(open) {
        widget.classList.toggle('open', open);
        bubble.setAttribute('aria-expanded', open);
        bubble.setAttribute('aria-label', open ? 'Close FAQ' : 'Open FAQ');
        icon.className = open ? 'fa-solid fa-xmark' : 'fa-solid fa-question';
    }

    bubble.addEventListener('click', function () {
        setOpen(!widget.classList.contains('open'));
    });

    widget.querySelectorAll('.faq-question').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var item = btn.parentElement;
            var open = !item.classList.contains('open');
            item.classList.toggle('open', open);
            btn.setAttribute('aria-expanded', open);
        });
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') setOpen(false);
    });

    document.addEventListener('click', function (e) {
        if (!widget.contains(e.target)) setOpen(false);
    });
})();
