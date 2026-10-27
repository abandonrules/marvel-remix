Handlebars.registerHelper('i18n', function () {
  var key = '';
  for (var arg in arguments) {
    if (typeof arguments[arg] != 'object') {
      key += arguments[arg];
    }
  }
  try {
    return jQuery.i18n.prop(key);
  } catch (e) {
    return key;
  }
});

Handlebars.registerHelper('ifPositive', function (value, options) {
  if (value > 0) {
    return options.fn(this);
  }
  return options.inverse(this);
});

Handlebars.registerHelper('ifEquals', function (arg1, arg2, options) {
  return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
});

Handlebars.registerHelper('ifIncludes', function (arg1, arg2, options) {
  return (arg1 !== undefined && arg1.includes(arg2)) ? options.fn(this) : options.inverse(this);
});

var languages = {
  'en': 'English',
}

$(document).ready(function () {
  const lang = localStorage.getItem('language') || 'en';
  jQuery.i18n.properties({
    name: 'Messages',
    path: 'i18n/',
    mode: 'map',
    cache: true,
    language: lang,
    async: true,
    callback: function () {
      showCards();
      getHandsFromQueryString();
      $('#sound-state').change(function () {
        toggleSound();
      });
      updateLabels(lang);
    }
  });
});

var click = new Audio('sound/click.mp3');
var swoosh = new Audio('sound/swoosh.mp3');
var clear = new Audio('sound/clear.mp3');
var magic = new Audio('sound/magic.mp3');
var actionId = NONE;
var hands = [hand];
var activeHandIndex = 0;

function selectLanguage(lang) {
  localStorage.setItem('language', lang);
  jQuery.i18n.properties({
    name: 'Messages',
    path: 'i18n/',
    mode: 'map',
    cache: true,
    language: lang,
    async: true,
    callback: function () {
      swoosh.play();
      showCards();
      updateLabels(lang);
    }
  });
}

function updateLabels(lang) {
  $('#clear').html(jQuery.i18n.prop('button.reset'));
  $('#sound-label').html(jQuery.i18n.prop('button.sound'));
  $('#selected-language').html(languages[lang]);
  $('#language .dropdown-item').removeClass('active');
  $('#lang-' + lang).addClass('active');
}

function setActiveHand(index) {
  if (index < 0 || index >= hands.length) {
    return;
  }
  click.play();
  activeHandIndex = index;
  hand = hands[activeHandIndex];
  updateHandView();
  showCards();
  updateCardOwners();
}

function addPlayer() {
  click.play();
  hands.push(new Hand());
  activeHandIndex = hands.length - 1;
  hand = hands[activeHandIndex];
  updateHandView();
  showCards();
  updatePlayerBar();
  updateCardOwners();
}

function removePlayer() {
  if (hands.length <= 1) {
    return;
  }
  click.play();
  hands.splice(activeHandIndex, 1);
  if (activeHandIndex >= hands.length) {
    activeHandIndex = hands.length - 1;
  }
  hand = hands[activeHandIndex];
  updateHandView();
  showCards();
  updatePlayerBar();
  updateCardOwners();
}

function updatePlayerBar() {
  var html = '';
  for (var i = 0; i < hands.length; i++) {
    var score = hands[i].score();
    if (i === activeHandIndex) {
      html += '<button type="button" class="btn btn-sm btn-primary" onclick="setActiveHand(' + i + ')">P' + (i + 1) + ': ' + score + '</button> ';
    } else {
      html += '<button type="button" class="btn btn-sm btn-secondary" onclick="setActiveHand(' + i + ')">P' + (i + 1) + ': ' + score + '</button> ';
    }
  }
  html += '<button type="button" class="btn btn-sm btn-success" onclick="addPlayer()">+</button> ';
  if (hands.length > 1) {
    html += '<button type="button" class="btn btn-sm btn-danger" onclick="removePlayer()">-</button>';
  }
  $('#players').html(html);
}

function updateCardOwners() {
  if (!$('#cards').length) {
    return;
  }
  $('#cards li.list-group-item').each(function () {
    var match = ($(this).attr('onclick') || '').match(/addToView\('([^']+)'\)/);
    if (!match) {
      return;
    }
    var id = match[1];
    var owners = [];
    if (typeof hands !== 'undefined' && hands) {
      for (var i = 0; i < hands.length; i++) {
        if (hands[i].getCardById(id) !== undefined) {
          owners.push('P' + (i + 1));
        }
      }
    }
    var span = $(this).find('.owners');
    if (owners.length === 0) {
      span.remove();
    } else {
      var text = ' (' + owners.join(', ') + ')';
      if (span.length) {
        span.text(text);
      } else {
        $(this).append(' <span class="owners">' + text + '</span>');
      }
    }
  });
}

function reset() {
  clear.play();
  for (var _h = 0; _h < hands.length; _h++) {
    hands[_h].clear();
  }
  hand = hands[activeHandIndex];
  showCards();
  updateHandView();
  actionId = NONE;
  $("#hand").show();
}

function toggleSound() {
  click.muted = swoosh.muted = clear.muted = magic.muted = !click.muted;
  clear.play();
}

function addToView(id) {
  if (hand.addCard(deck.getCardById(id))) {
    click.play();
    updateHandView();
    actionId = NONE;
  }
}

function selectFromHand(id) {
  switch (actionId) {
    case XJET:
      click.play();
      hand.getCardById(actionId).actionData = [id];
      updateHandView();
      break;

    default:
      removeFromHand(id);
  }

  actionId = NONE;
}

function removeFromHand(id) {
  swoosh.play();
  hand.deleteCardById(id);
  updateHandView();
}

function updateHandView() {
  var template = Handlebars.compile($("#hand-template").html());
  var score = hand.score();
  var html = template({
    playerCards: hand.cards()
  }, {
    allowProtoMethodsByDefault: true
  });
  $('#hand').html(html);
  if (score >= 0) {
    $('#points').text(('000' + score).slice(-3));
  } else {
    $('#points').text('-' + ('000' + Math.abs(score)).slice(-3));
  }
  $('#cardCount').text(hand.size());
  $('#cardLimit').text(hand.limit());
  if (hand.empty()) {
    $('#settings').show();
  } else {
    $('#settings').hide();
  }
  updatePlayerBar();
  updateCardOwners();
  updateUrl();
}

function updateUrl() {
  var params = [];
  var handStrings = hands.map(function (h) { return h.empty() ? '' : h.toString(); });
  if (handStrings.some(function (str) { return str !== ''; })) {
    params.push('hands=' + handStrings.map(function (str) { return str === '' ? '_' : str; }).join('|'));
  }
  if (params.length > 0) {
    history.replaceState(null, null, "index.html?" + params.join('&'));
  } else {
    history.replaceState(null, null, "index.html");
  }
}

function getHandsFromQueryString() {
  var params = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
  for (var i = 0; i < params.length; i++) {
    var param = params[i].split('=');
    if (param[0] === 'hands') {
      var handStrings = decodeURIComponent(param[1]).replace(/ /g, '+').split('|');
      hands = [];
      for (var h = 0; h < handStrings.length; h++) {
        var newHand = new Hand();
        if (handStrings[h] !== '_' && handStrings[h] !== '') {
          newHand.loadFromString(handStrings[h]);
        }
        hands.push(newHand);
      }
      if (hands.length === 0) {
        hands = [new Hand()];
      }
      activeHandIndex = 0;
      hand = hands[activeHandIndex];
    } else if (param[0] === 'hand') {
      if (hands.length === 1 && hands[0].empty()) {
        hands[0].loadFromString(decodeURIComponent(param[1]).replace(/ /g, '+'));
        hand = hands[0];
      }
    }
  }
  updateHandView();
  updatePlayerBar();
  updateCardOwners();
}

function useCardAction(id) {
  click.play();
  actionId = id;
  hand.undoCardAction(id);
  showCards();

  switch (id) {
    case XJET:
      const template = Handlebars.compile($('#hand-template').html());
      const html = template({
        playerCards: hand.cards()
            .filter(card => card.type === 'hero' || card.type === 'ally' || card.id === XJET)
      });
      $('#hand').html(html);
      break;

    default:
      updateHandView();
      break;
  }

  $('#card-action-text-' + id).html(jQuery.i18n.prop(id + '.action'));
  $('#card-action-use-' + id).hide();
  $('#card-action-cancel-' + id).show();
}

function cancelCardAction(id) {
  click.play();
  hand.undoCardAction(id)
  actionId = NONE;
  $('#card-action-cancel-' + id).hide();
  $('#card-action-use-' + id).show();
  showCards();
  updateHandView();
}

function toggleVisionTag(tag) {
  var vision = hand.getCardById(VISION);
  if (vision.actionData === undefined) {
    vision.actionData = [tag];
    magic.play();
  } else if (vision.actionData.includes(tag)) {
    vision.actionData = vision.actionData.filter(t => t !== tag);
    swoosh.play();
  } else if (vision.actionData.length < 2) {
    vision.actionData.push(tag);
    magic.play();
  }
  showCards();
  updateHandView();
}

function showCards(types) {
  var cardsByType = deck.getCardsByType(types);
  for (var _type in cardsByType) {
    for (var _c = 0; _c < cardsByType[_type].length; _c++) {
      var _card = cardsByType[_type][_c];
      var _owners = [];
      if (typeof hands !== 'undefined' && hands) {
        for (var _i = 0; _i < hands.length; _i++) {
          if (hands[_i].getCardById(_card.id) !== undefined) {
            _owners.push(_i + 1);
          }
        }
      }
      _card.owners = _owners;
    }
  }
  var template = Handlebars.compile($("#cards-template").html());
  var html = template({
    types: cardsByType,
  }, {
    allowProtoMethodsByDefault: true
  });
  $('#cards').html(html);
}
