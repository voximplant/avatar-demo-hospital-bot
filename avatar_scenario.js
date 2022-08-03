
// Buttons for telegram integraions
const startButton = ['📝 Запись на прием', '❌ Отмена записи', '⏱ Время работы', '🐒 Тесты на обезьянью оспу', '🏠 Адреса отделений']
const addresses = ['Мытная 66 (Метро Тульская)', 'Большая Серпуховская 55 (Метро Серпуховская)', 'Камергерский переулок 10 (Метро Цветной Бульвар)']
const addressesTimes = {
  'Мытная 66 (Метро Тульская)': 'ежедневно с 9:00 до 18:00', 
  'Большая Серпуховская (Метро Серпуховская)': 'с понедельника по пятницу с 9:00 до 17:00', 
  'Камергерский переулок 10 (Метро Цветной Бульвар)': 'ежедневно с 9:00 до 15:00'
}
const yesNoButtons = ['✅ Да', '❌ Нет']
const phoneNumberRegexp = /[\+]?[78][\d]{10}/i

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// conversation context
//
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
let lastUtterance = null
let lastCustomData = null

let phone = null
let cancelReason = null
let customDate = null
let name = null
let listOfPhone = []
let lastPhoneNumberDigits = ''
let phoneNumberFailedCount = 0
let phoneNumberNextState = null
let resultPhone = null
let operatorPhrase = 'Перевожу на оператора'
let address = null
let book_prephrase = null


let existingVisits = []
let existingVisitToCancel = null
let visitToCancelDescription = ''

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// serialization/deserialization
//
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
if (!getCustomData().voice) {
  setEventHandler(Events.Serializing, async (pack) => {
    let formDoctorTimePack = {
      doctor: {value: formDoctorTime.doctor.value, requestedCounter: formDoctorTime.doctor.requestedCounter},
      preferrabeDay: {
        value: formDoctorTime.preferrabeDay.value, 
        valueRangeEnd: formDoctorTime.preferrabeDay.valueRangeEnd, 
        grain: formDoctorTime.preferrabeDay.grain, 
        requestedCounter: formDoctorTime.preferrabeDay.requestedCounter
      }
    }
    return {lastUtterance, lastCustomData, phone, cancelReason, customDate, name, listOfPhone, lastPhoneNumberDigits, phoneNumberFailedCount, phoneNumberNextState, resultPhone, operatorPhrase, address, existingVisits, existingVisitToCancel, visitToCancelDescription, formDoctorTime: formDoctorTimePack}
  })

  setEventHandler(Events.Deserializing, async (pack) => {
    formDoctorTime.doctor.value = pack.formDoctorTime.doctor.value
    formDoctorTime.doctor.requestedCounter = pack.formDoctorTime.doctor.requestedCounter
    formDoctorTime.preferrabeDay.value = pack.formDoctorTime.preferrabeDay.value
    formDoctorTime.preferrabeDay.valueRangeEnd = pack.formDoctorTime.preferrabeDay.valueRangeEnd
    formDoctorTime.preferrabeDay.grain = pack.formDoctorTime.preferrabeDay.grain
    formDoctorTime.preferrabeDay.requestedCounter = pack.formDoctorTime.preferrabeDay.requestedCounter
    lastUtterance = pack.lastUtterance
    lastCustomData = pack.lastCustomData
    phone = pack.phone
    cancelReason = pack.cancelReason
    customDate = pack.customDate
    name = pack.name
    listOfPhone = pack.listOfPhone
    lastPhoneNumberDigits = pack.lastPhoneNumberDigits
    phoneNumberFailedCount = pack.phoneNumberFailedCount
    phoneNumberNextState = pack.phoneNumberNextState
    resultPhone = pack.resultPhone
    operatorPhrase = pack.operatorPhrase
    address = pack.address
    existingVisits = pack.existingVisits
    existingVisitToCancel = pack.existingVisitToCancel
    visitToCancelDescription = pack.visitToCancelDescription
  })
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// helper functions
//
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function analyticsSendEvent(event) {
  // You can use any analytics system of choice
  // We use https://mixpanel.com/
  const mixpanel_token = 'ENTER_YOUR_MIXPANEL_TOKEN_HERE'
  const eventBody = {
    "event": event,
    "properties": {
      "distinct_id": getCustomData().callerId || 'debug',
      "token": mixpanel_token,
      "Referred By": "Avatar",
    "$phone": getCustomData().callerId || 'debug',
    }
  }
  const data = base64_encode(JSON.stringify(eventBody))
  httpRequest(
    `https://api.mixpanel.com/track/?data=${data}`, 
    {method: 'GET'}
  )
}

function dateButtons() {
  let buttons = []
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
  let dt = new Date();
  for (const i of [1, 2, 3, 4, 5]) {
    dt.setDate(dt.getDate() + 1)
    while (dt.getDay() === 0 || dt.getDay() === 6) {
      dt.setDate(dt.getDate() + 1)
    }
    buttons.push(`${dt.getDate()} ${months[dt.getMonth()]}`)
  }
  return {avatarPortalData: {inlineKeyboardButtons: buttons}}
}

function dateToString(dt) {
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
  return `${parseInt(dt.substring(8,10))} ${months[parseInt(dt.substring(5,7))-1]}`
}

function timeToString(dt) {
  // 2016-12-14T09:00:00.000-08:00
  return dt.substring(11,16)
}

function dateTimeToVoice(dateTimeBegin, dateTimeEnd) {
  if (dateTimeEnd) {
    dateResponse = `${dateToString(dateTimeBegin)} удобный промежуток времени с ${timeToString(dateTimeBegin)} до ${timeToString(dateTimeEnd)}.`
  } else {
    dateResponse = `${dateToString(dateTimeBegin)} на ${timeToString(dateTimeBegin)}.`
  }
  return dateResponse
}

function SmartResponse(ev) {
  const result = Response(ev)
  if (ev.utterance) {
    lastUtterance = ev.utterance
    lastCustomData = ev.customData
  }
  return result
}

function fillPhoneSlot(entity) {
  lastPhoneNumberDigits = ''
  for (var ent of entity) {
    listOfPhone.push(ent.value)
    lastPhoneNumberDigits = lastPhoneNumberDigits + ' ' + ent.value
  }
  if (listOfPhone.length > 0) {
    resultPhone = listOfPhone.join('')
    spacePhone = listOfPhone.join(' ')
  }
  if ((resultPhone.length === 10 && resultPhone[0] != '7' && resultPhone[0] != '8') || resultPhone.length === 11) {
    return 'next state'
  } else if (resultPhone.length > 11) {
    listOfPhone = []
    return 'repeat'
  } else {
    return 'continue'
  }
}

function fillPhoneSlotClear() {
  listOfPhone = [];
  lastPhoneNumberDigits = '';
  resultPhone = null;
}


let formDoctorTime = {
    doctor: { /* slot name */
      value: null,  /* collected value will be stored here */
      entity: 'doctorType',  /* which entity time are we expecting? (can be both system or custom) */
      customDataFunc: () => {
        return {avatarPortalData: {inlineKeyboardButtons: ['Терапевт', 'Хирург', 'Педиатр', 'Гинеколог', 'Уролог', 'Невролог', 'Офтальмолог']}}
      },
      utterances: [   /* phrases to ask user for this slot */
        'А к какому врачу вы хотите записаться?', /* phrase to use at first */
        'Либо я вас не поняла, либо не могу найти в базе такого врача - можете, пожалуйста, повторить?',
        'Я все еще не могу найти в базе, опишите своими словами процедуру и врача и я запишу эту информацию для оператора' /* ask again if answer doesn't make any sense after first attempt */
      ],
      optional: false,   /* can we skip this slot if user haven't passed this info? */
      requestedCounter: 0 /* how many times we've asked user to fill this slot */
    },
    preferrabeDay: {
      value: null,
      valueRangeEnd: null,
      grain: null,
      entity: 'systemTime',
      customDataFunc: dateButtons,
      customDataTimeFunc: () => {
        return {avatarPortalData: {inlineKeyboardButtons: ['с 9:00 до 11:00', 'c 11:00 до 13:00', 'с 13:00 до 15:00', 'с 15:00 до 17:00', 'с 17:00 до 19:00']}}
      },
      utterances: [
        'А на какой день и интервал времени вы хотели бы записаться?',
        'Не совсем поняла, на какой день вас интересует запись?'
      ],
      utterancesTimeInterval: [
        'Ага, а на какой интервал времени вы хотели бы записаться?',
        'И на какой интервал времени? Или, может быть, на конкретное время?',
        'Не совсем поняла, на какой интервал времени? Или, может быть, на конкретное время?'
      ],
      optional: false,
      requestedCounter: 0
    },
}

function fillFormData(form, utteranceEvent) {
  const entities = utteranceEvent.entities
  const text = utteranceEvent.text

  /* try to fill data, required by form */
  if (entities) {
    if (entities.systemTime) {
      if (form.preferrabeDay.value === null) {
        form.preferrabeDay.value = entities.systemTime[0].value
        form.preferrabeDay.grain = entities.systemTime[0].grain
        form.preferrabeDay.requestedCounter = 1
      } else if (form.preferrabeDay.grain === 'day' && (entities.systemTime[0].grain === 'hour' || entities.systemTime[0].grain === 'minute')) {
          const date = form.preferrabeDay.value.split("T")[0]
          const time = entities.systemTime[0].value.split("T")[1]
          form.preferrabeDay.value = `${date}T${time}`
          form.preferrabeDay.grain = entities.systemTime[0].grain
          form.preferrabeDay.requestedCounter = 1
      }
    }
    if (entities.systemTimeRange) {
      const rangeStart = entities.systemTimeRange[0].value;
      const rangeEnd = entities.systemTimeRange[0].valueRangeEnd
      const rangeGrain = entities.systemTimeRange[0].grain
      if (form.preferrabeDay.value === null || form.preferrabeDay.grain === 'month' || form.preferrabeDay.grain === 'year') {
        form.preferrabeDay.value = rangeStart
        form.preferrabeDay.valueRangeEnd = rangeEnd
        form.preferrabeDay.grain = rangeGrain
        form.preferrabeDay.requestedCounter = 1

        // scpecial case: tomorrow from 12 - then valueRangeEnd is not set
        if (rangeEnd === null && (rangeGrain === 'hour' || rangeGrain === 'minute')) {
          form.preferrabeDay.valueRangeEnd = rangeStart.split('T')[0] + 'T20:00:00.000-' + rangeStart.split('-')[1]
          form.preferrabeDay.requestedCounter = 1
        }
      } else if (rangeGrain === 'hour' || rangeGrain === 'minute') {
        const intervalDate = form.preferrabeDay.value.split('T')[0]
        const intervalStartTime = rangeStart.split('T')[1]
        const intervalEndTime = rangeEnd ? rangeEnd.split('T')[1] : '20:00:00.000-' + rangeStart.split('-')[1]
        
        form.preferrabeDay.value = `${intervalDate}T${intervalStartTime}`
        form.preferrabeDay.valueRangeEnd = `${intervalDate}T${intervalEndTime}`
        form.preferrabeDay.grain = rangeGrain
        form.preferrabeDay.requestedCounter = 1

        // scpecial case: tomorrow from 12 - then valueRangeEnd is not set
        if (rangeEnd === null) {
          form.preferrabeDay.valueRangeEnd = rangeStart.split('T')[0] + 'T20:00:00.000-' + rangeStart.split('-')[1]
          form.preferrabeDay.requestedCounter = 1
        }
      }
    }

    if (formDoctorTime.doctor.value === null) {
      // second question is "ok, I don't get it - just say it with your own words"
      if (formDoctorTime.doctor.requestedCounter < 2) {
        if (entities.doctorType) {
          formDoctorTime.doctor.value = entities.doctorType[0].value
        }
      } else {
        if (entities.doctorType) {
          formDoctorTime.doctor.value = entities.doctorType[0].value
        } else {
          formDoctorTime.doctor.value = text
        }
      }
    }
  }
}

function cleanFormData(form) {
  /* clean data of form */
    for (const [slotId, slot] of Object.entries(form)) { 
      slot.value = null
      slot.requestedCounter = 0
      if (slot.entity === 'systemTime') {
        slot.grain = null
        slot.valueRangeEnd = null
      }
    }
  }


function checkFormState() {
    /* if any of required slots is not filled up - then ask customer for this data specifically
     states [str] - current state of slot filling
     - inprogress - some required slots are not filled up yet
     - done - all required slots are filled up
     - failed - user hasn't filled up required slot even though they were asked specifically about this info

     utterance [str] - an utterance to ask user about missing information
      */

  // doctor
  if (formDoctorTime.doctor.value === null) {
    formDoctorTime.doctor.requestedCounter += 1
    if (formDoctorTime.doctor.requestedCounter <= formDoctorTime.doctor.utterances.length) {
      return {status: 'inprogress', utterance: formDoctorTime.doctor.utterances[formDoctorTime.doctor.requestedCounter-1], customData: formDoctorTime.doctor.customDataFunc()}
    } else {
      return {status: 'failed', utterance: null}
    }
  }

  // timerange
  if (formDoctorTime.preferrabeDay.value === null || formDoctorTime.preferrabeDay.grain === 'month' || formDoctorTime.preferrabeDay.grain === 'year') {
    formDoctorTime.preferrabeDay.requestedCounter += 1
    if (formDoctorTime.preferrabeDay.requestedCounter <= formDoctorTime.preferrabeDay.utterances.length) {
      return {status: 'inprogress', utterance: formDoctorTime.preferrabeDay.utterances[formDoctorTime.preferrabeDay.requestedCounter-1], customData: formDoctorTime.preferrabeDay.customDataFunc()}
    } else {
      return {status: 'failed', utterance: null}
    }
  } else if (formDoctorTime.preferrabeDay.grain === 'day') {
    formDoctorTime.preferrabeDay.requestedCounter += 1
    if (formDoctorTime.preferrabeDay.requestedCounter <= formDoctorTime.preferrabeDay.utterancesTimeInterval.length) {
      return {status: 'inprogress', utterance: formDoctorTime.preferrabeDay.utterancesTimeInterval[formDoctorTime.preferrabeDay.requestedCounter-1], customData: formDoctorTime.preferrabeDay.customDataTimeFunc()}
    } else {
      return {status: 'failed', utterance: null}
    }
  }
  return {status: 'done', utterance: null}
}



///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// dialog states
//
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

addState({
  name: 'start',
  onEnter: async (event) => {
    cleanFormData(formDoctorTime)
    address = null
    phone = null
    analyticsSendEvent('Start')
    if (event.visitsCounter === 1) {
      return SmartResponse({
        utterance: 'Добрый день! Вас приветствует клиника Sacred Hearts, чем могу вам помочь?',
        listen: true,
        customData: {avatarPortalData: {inlineKeyboardButtons: startButton}}
      });
    } else {
      return SmartResponse({
        listen: true
      });
    }
  },
  onUtterance:async(event)=>{
    if (event.text === '/start') { // for telegram bot
      return SmartResponse({
        utterance: 'Добрый день! Вас приветствует клиника Sacred Hearts, чем могу вам помочь?',
        listen: true,
        customData: {avatarPortalData: {inlineKeyboardButtons: startButton}}
      })
    }
    if (event.intent === 'symptoms') {
      fillFormData(formDoctorTime, event)
      if (!formDoctorTime.doctor.value) {
        book_prephrase = 'Если вы не уверены к какому врачу вы хотите записаться, я бы рекомендовала первичный осмотр Терапевта. Но если вы точно знаете, к кому хотите обратиться, то можете выбрать сразу его.'
      }
      return SmartResponse({nextState: 'book'})
    } else if (event.text === '❓ Другое' || event.intent === 'operator') {
      operatorPhrase = 'Одну секунду, проверю, есть ли доступные операторы'
      return SmartResponse({nextState: 'operator'})
    } else if (event.intent === 'monkeyOspa') {
      if (getCustomData().voice) {
        return SmartResponse({utterance: 'Мы разделяем вашу озабоченность этой новой болезнью. Прямо сейчас мы не умеем ее клинически диагностировать. Но если вы начинаете превращаться в обезьяну, пожалуйста, срочно вызовите скорую помощь. Может, я могу помочь чем-то еще?', nextState: 'start', customData: {avatarPortalData: {inlineKeyboardButtons: startButton}}})
      } else {
        return SmartResponse({utterance: 'Мы разделяем вашу озабоченность этой новой болезнью. Прямо сейчас мы не умеем ее клинически диагностировать. Но мы разработали очень простой метод домашней диагностики - если вы становитесь похожи на примата с фото, пожалуйста срочно вызовите скорую помощь. Может, я могу помочь чем-то еще?', nextState: 'start', customData: {avatarPortalData: {inlineKeyboardButtons: startButton, attachmentImage: 'https://cdn.vox-cdn.com/thumbor/G_Ts5lMSVPW3grBjSZ924gvyg-s=/0x0:666x444/1200x800/filters:focal(266x140:372x246)/cdn.vox-cdn.com/uploads/chorus_image/image/59491841/Macaca_nigra_self-portrait__rotated_and_cropped_.0.jpg', attachmentImageMime: 'image/jpeg'}}})
      }
    } else if (event.intent === 'visitDoctor') {
      fillFormData(formDoctorTime, event)
      return SmartResponse({nextState: 'book'})
    } else if (event.intent === 'testReadiness') {
      return SmartResponse({utterance: 'Проверить результаты тестов вы можете на сайте, зайдя в личный кабинет, увы я не могу их вам передать по телефону, так как это конфиденциальная информация. Могу помочь вам чем-то еще?', nextState: 'start', customData: {avatarPortalData: {inlineKeyboardButtons: startButton}}})
    } else if (event.intent === 'callDoctor') {
      operatorPhrase = 'Наш оператор поможет вам вызвать врача на дом'
      return SmartResponse({nextState: 'operator'})
    } else if (event.intent === 'pricing' || event.intent === 'haveService') {
      fillFormData(formDoctorTime, event)
      if (formDoctorTime.doctor.value) {
        return SmartResponse({nextState: 'suggestBooking'})
      } else {
        operatorPhrase = 'Я не уверена насчет этой услуги, сейчас переведу на специалиста, который вам точно подскажет'
        return SmartResponse({nextState: 'operator'})
      }
    } else if (event.intent === 'yes' || event.intent === 'welcome' || event.intent === 'whatcani') {
      return SmartResponse({utterance: 'Я могу помочь вам записаться к специалисту или на процедуру, по остальным вопросам вам сможет подсказать наш оператор. Так чем могу помочь?', listen: true, customData: {avatarPortalData: {inlineKeyboardButtons: startButton}}})
    } else if (event.intent === 'no' || event.intent === 'bye') {
      return SmartResponse({utterance: 'Спасибо за обращение, всего доброго!', nextState: 'doorway', customData: {isFinal: true}})
    } else if (event.intent === 'cencel') {
      //phoneNumberNextState = 'CancelReason'
      return SmartResponse({nextState: 'CancelSelect'})
    } else if (event.intent === 'doctorTime') {
      if (event.entities.address) {
        address = event.entities.address[0].value
      }
      return SmartResponse({nextState: 'openingHours'})
    } else if (event.intent === 'locations') {
      if (getCustomData().voice) {
        return SmartResponse({utterance: 'У нас есть клиники по адресам ул Мытная дом 66 - метро Тульская, ул Большая Серпуховская дом 55 - метро Серпуховская и в Камергерском переулке дом 10 - это метро Цветной Бульвар. Могу помочь вам чем-то еще?', nextState: 'start'})
      } else {
        return SmartResponse({utterance: 'У нас есть клиники по адресам: \n🏠 ул Мытная дом 66 (метро Тульская), \n🏠 ул Большая Серпуховская дом 55 (метро Серпуховская) \n🏠 Камергерский переулок дом 10 (метро Цветной Бульвар). \n\nМогу помочь вам чем-то еще?', nextState: 'start', customData: {avatarPortalData: {inlineKeyboardButtons: startButton}}})
      }
    } else if (event.intent === 'move') {
      operatorPhrase = 'Наш оператор поможет вам перенести запись на удобное время, одну секунду'
      return SmartResponse({nextState: 'operator'})
    } else if (event.intent === 'coronavirus') {
      return SmartResponse({nextState: 'coronavirus'})
    } else if (event.intent === 'repeat') {
      return SmartResponse({utterance: lastUtterance, listen: true})
    } else if (event.utteranceCounter < 3) {
      const reAskingPhrases = [
        'Что, простите?',
        'Все еще не поняла. Я могу помочь вам вызвать врача на дом, записать к специалисту или проконсультировать по поводу тестов на коронавирус, по остальным вопросам вам сможет подсказать наш оператор. Так чем могу помочь?',
        'Что, простите?',
        'Что, простите?',
        'Что, простите?',
      ]
      return SmartResponse({ utterance: reAskingPhrases[event.utteranceCounter - 1], listen: true, customData: {avatarPortalData: {inlineKeyboardButtons: startButton}} })
    } else {
      operatorPhrase = 'К сожалению, я вас не поняла, сейчас попробую найти оператора, который вам поможет'
      return SmartResponse({ nextState: 'operator' })
    }
  },
});

addState({
  name: 'coronavirus',
  onEnter: async (event) => {
    analyticsSendEvent('Corona')
    if (!getCustomData().voice) {
      return SmartResponse({utterance: 'Мы проводим тесты на коронавирус методом ПЦР - вы можете прийти в любую нашу клинику с 9:00 до 18:00 и получить услугу в порядке живой очереди. Наши рекомендации по подготовке:\n- Взятие мазков рекомендуется проводить не раньше 3-4 часов после последнего приёма пищи. Коронавирус SARS-Cov-2 живет внутри эпителиальных клеток. Для ПЦР-исследования важно получить мазок с достаточным количеством инфицированных клеток. В момент проглатывания еды эпителиальные клетки механически слущиваются пищевым комком с поверхности слизистой оболочки. Если взять мазок сразу после еды, в пробирку может попасть недостаточное количество инфицированных клеток.\n- Перед взятием мазков ни в коем случае нельзя использовать лекарственные средства для местного применения (капли, спреи и др). После их применения количество вируса на слизистой снижается и увеличивается вероятность получения ложноотрицательных результатов ПЦР-теста.\n- Не чистить зубы перед взятием мазка. Основная цель на этапе взятия мазков для ПЦР-исследования – получить биологический материал с достаточным количеством клеток, пораженных коронавирусом. Применение любых очищающих средств для полости рта снижает количество вируса в получаемом мазке.\n - Отказаться от употребления алкоголя не менее чем за 2 дня до взятия мазка. Алкоголь содержит этиловый спирт (этанол), который также входит в состав многих антисептических средств, поэтому после приема алкоголя вероятность выявления коронавируса в мазке также может снизиться.\n\nМогу помочь вам чем-то еще?', nextState: 'start', customData: {avatarPortalData: {inlineKeyboardButtons: startButton}}})
    } else {
      return SmartResponse({utterance: 'Мы проводим тесты на коронавирус методом ПЦР - вы можете прийти в любую нашу клинику с 9:00 до 18:00 и получить услугу в порядке живой очереди. Хотите, я вышлю вам СМС с правилами подготовки к сдаче теста?', listen: true})
    }
  },
  onUtterance: async (event) => {
    /* add handling for intents, which are appropriate in the middle of slot filling */
    if (event.intent === 'yes') {
      return SmartResponse({utterance: 'Я вышлю смс по окончании разговора, могу помочь чем-то еще?',nextState: 'start', customData: {avatarPortalData: {inlineKeyboardButtons: startButton}}})
    } else if (event.intent === 'no' || event.intent === 'stop') {
      return SmartResponse({utterance: `Ясно. Могу помочь чем-то еще?`, nextState: 'start', customData: {avatarPortalData: {inlineKeyboardButtons: startButton}}})
    } else if (event.intent === 'operator') {
      operatorPhrase = 'У меня возникли проблемы, я попробую перевести вас на оператора'
      return SmartResponse({nextState: 'operator'})
    } else if (event.intent === 'repeat') {
        return SmartResponse({utterance: lastUtterance, listen: true})
    } else {
      if (event.utteranceCounter < 3) {
        return SmartResponse({utterance: 'Что, простите?', listen: true})
      } else {
        operatorPhrase = 'У меня возникли проблемы, я попробую перевести вас на оператора'
        return SmartResponse({nextState: 'operator'})
      }
    }
  },
});

addState({
  name: 'openingHours',
  onEnter: async (event) => {
    analyticsSendEvent('OpeningHours')
    if (getCustomData().voice) {
      return SmartResponse({utterance: 'Наши клиники работают с понедельника по пятницу с 10 утра до 9 вечера. Мы принимаем анализы в рабочие дни с 10 утра до 12. Если вы хотите узнать время работы конкретного специалиста, я могу соединить вас с живым оператором и он вам поможет. Соединяю?', listen: true, customData: {avatarPortalData: {inlineKeyboardButtons: yesNoButtons}}})
    } else {
      if (!address) {
        return SmartResponse({utterance:'А какая клиника вас интересует?', listen: true, customData: {avatarPortalData: {inlineKeyboardButtons: addresses}}})
      } else {
        return SmartResponse({utterance: `Время работы клиники ${address}: ${addressesTimes[address]}. Могу помочь чем-то еще?`, customData: {avatarPortalData: {inlineKeyboardButtons: startButton}}, nextState: 'start'})
      }
    }
  },
  onUtterance: async (event) => {
    if (event.entities.address) {
      address = event.entities.address[0].value
    }
    /* add handling for intents, which are appropriate in the middle of slot filling */
    if (!getCustomData().voice && address) {
      return SmartResponse({utterance: `Время работы клиники ${address}: ${addressesTimes[address]}. Могу помочь чем-то еще?`, customData: {avatarPortalData: {inlineKeyboardButtons: startButton}}, nextState: 'start'})
    } else if (event.intent === 'yes' || event.intent === 'operator') {
      operatorPhrase = 'Одну секунду'
      return SmartResponse({nextState: 'operator'})
    } else if (event.intent === 'no' || event.intent === 'stop') {
      return SmartResponse({utterance: `Ясно. Могу помочь чем-то еще?`, nextState: 'start', customData: {avatarPortalData: {inlineKeyboardButtons: startButton}}})
    } else if (event.intent === 'repeat') {
        return SmartResponse({utterance: lastUtterance, listen: true})
    } else {
      if (getCustomData().voice) {
        if (event.utteranceCounter < 2) {
          return SmartResponse({utterance: 'Что, простите?', listen: true, customData: {avatarPortalData: {inlineKeyboardButtons: yesNoButtons}}})
        } else {
          operatorPhrase = 'У меня возникли проблемы, я попробую перевести вас на оператора'
          return SmartResponse({nextState: 'operator'})
        }
      } else {
        if (event.utteranceCounter < 2) {
          return SmartResponse({utterance: 'Не совсем поняла, клиника по какому адресу вас интересует?', listen: true, customData: {avatarPortalData: {inlineKeyboardButtons: addresses}}})
        } else {
          return SmartResponse({utterance: 'Видимо, меня плохо обучили, я вас не поняла 😢, могу помочь чем-то еще?', customData: {avatarPortalData: {inlineKeyboardButtons: startButton}}, nextState: 'start'})
        }
      }
    }
  },
});

addState({
  name: 'book',
  onEnter: async (event) => {
    analyticsSendEvent('Book')
    let {status, utterance, customData} = checkFormState()
    if (utterance) {
      if (book_prephrase) {
        utterance = book_prephrase + utterance
        book_prephrase = null
      }
      if (getCustomData().voice) {
        return SmartResponse({utterance: utterance, listen: true, customData: customData})
      } else {
        return SmartResponse({utterance: utterance + '\n(выберите из списка или введите в свободной форме)', listen: true, customData: customData})
      }
    } else {
      if (status === 'done') {
        Logger.write(`done`) /* send collected data to log */
        return SmartResponse({nextState: 'bookConfirmation'})
      } else {
        operatorPhrase = 'У меня возникли проблемы, я попробую перевести вас на оператора'
        return SmartResponse({nextState: 'operator'})
      }
    }
  },
  onUtterance: async (event) => {
    /* add handling for intents, which are appropriate in the middle of slot filling */
    if (event.intent === 'stop') {
      cleanFormData(formDoctorTime)
      return SmartResponse({utterance: 'Ясно, очень жаль. Могу помочь вам чем-то еще?', nextState: 'start', customData: {avatarPortalData: {inlineKeyboardButtons: startButton}}})
    }
    if (event.intent === 'symptoms' || event.intent === 'haveService' || (event.intent === 'idontknow' && !formDoctorTime.doctor.value) || (event.intent === 'whatcani' && !formDoctorTime.doctor.value)) {
      return SmartResponse({utterance: `У нас обширный список специалистов, если вы не уверены к какому, то могу записать вас к терапевту. ${lastUtterance}`, listen: true, customData: lastCustomData})
    } else if (event.intent === 'otherSlot' && !getCustomData().voice) {
      return SmartResponse({utterance: `Вы можете ввести любое время в свободной форме, а не только выбрать из списка. ${lastUtterance}`, listen: true, customData: lastCustomData})
    } else if (event.intent === 'doctorTime') {
      return SmartResponse({utterance: `Наши клиники работают с понедельника по пятницу с 10 утра до 9 вечера. Мы принимаем анализы в рабочие дни с 10 утра до 12. ${lastUtterance}`, listen: true, customData: lastCustomData})
    } else if (event.intent === 'idontknow') {
      operatorPhrase = 'Поняла, тогда я попытаюсь подключить оператора, чтобы он вам помог'
      return SmartResponse({nextState: 'operator'})
    } else if (event.intent === 'locations') {
      if (getCustomData().voice) {
        return SmartResponse({utterance: `У нас есть клиники по адресам ул Мытная дом 66 - метро Тульская, ул Большая Серпуховская дом 55 - метро Серпуховская и в Камергерском переулке дом 10 - это метро Цветной Бульвар. ${lastUtterance}`, listen: true, customData: lastCustomData})
      } else {
        return SmartResponse({utterance: `У нас есть клиники по адресам: \n🏠 ул Мытная дом 66 (метро Тульская), \n🏠 ул Большая Серпуховская дом 55 (метро Серпуховская) \n🏠 Камергерский переулок дом 10 (метро Цветной Бульвар). \n\n${lastUtterance}`, listen: true, customData: lastCustomData})
      }
    } else if (event.intent === 'no' || event.intent === 'stop') {
      cleanFormData(formDoctorTime)
      return SmartResponse({utterance: `Ясно. Могу помочь чем-то еще?`, nextState: 'start', customData: {avatarPortalData: {inlineKeyboardButtons: startButton}}})
    } else if (event.intent === 'operator') {
      operatorPhrase = 'У меня возникли проблемы, я попробую перевести вас на оператора'
      return SmartResponse({nextState: 'operator'})
    } else if (event.intent === 'repeat') {
        return SmartResponse({utterance: lastUtterance, listen: true})
    }
    fillFormData(formDoctorTime, event)
    return SmartResponse({nextState: 'book'}) /* go back to the same state and check if form is finally filled */
  },
});

addState({
  name: 'bookConfirmation',
  onEnter: async (event) => {
    analyticsSendEvent('BookConfirmation')
    return SmartResponse({utterance: `Итак, вы хотите записаться на ${dateTimeToVoice(formDoctorTime.preferrabeDay.value, formDoctorTime.preferrabeDay.valueRangeEnd)} Услуга: ${formDoctorTime.doctor.value}. Все верно?`, listen: true, customData: {avatarPortalData: {inlineKeyboardButtons: yesNoButtons}}})
  },
  onUtterance: async (event) => {
    /* add handling for intents, which are appropriate in the middle of slot filling */
    if (event.intent === 'yes') {
      phoneNumberNextState = 'BookName'
      return SmartResponse({nextState: 'phoneNumber'})
    } else if (event.intent === 'repeat') {
        return SmartResponse({utterance: lastUtterance, listen: true})
    } else {
      cleanFormData(formDoctorTime)
      return SmartResponse({nextState: 'bookTryOnceMore'}) /* go back to the same state and check if form is finally filled */
    }
  },
});

addState({
  name: 'bookTryOnceMore',
  onEnter: async (event) => {
    analyticsSendEvent('BookTryOnceMore')
    if (getCustomData().voice) {
      return SmartResponse({ utterance: 'Ясно, очень жаль, хотите, попробуем еще раз?', listen: true, customData: {avatarPortalData: {inlineKeyboardButtons: yesNoButtons}}})
    } else {
      return SmartResponse({utterance: 'Ясно, очень жаль. Могу помочь вам чем-то еще?', nextState: 'start', customData: {avatarPortalData: {inlineKeyboardButtons: startButton}}})
    }
  },
  onUtterance: async (event) => {
    /* add handling for intents, which are appropriate in the middle of slot filling */
    if (event.intent === 'yes' || event.intent === 'visitDoctor') {
      fillFormData(formDoctorTime, event)
      return SmartResponse({ nextState: 'book'})
    } else {
      operatorPhrase = 'Поняла, тогда я попытаюсь подключить оператора, чтобы он вам помог'
      return SmartResponse({nextState: 'operator'})
    }    
  },
});

addState({
  name: 'phoneNumber',
  onEnter: async (event) => {
    if (!getCustomData().phone) {
      return SmartResponse({nextState: 'phoneNumberInput'})
    } else {
      return SmartResponse({utterance: 'Могу я использовать номер, с которого вы звоните, для записи?', listen: true})
    }
  },
  onUtterance: async (event) => {
    /* add handling for intents, which are appropriate in the middle of slot filling */
    if (event.intent === 'yes') {
      phone = getCustomData().phone
      return SmartResponse({nextState: phoneNumberNextState})
    } else if (event.intent === 'no' || event.intent === 'stop') {
      return SmartResponse({nextState: 'phoneNumberInput'})
    } else {
      if (event.utteranceCounter < 3) {
        return SmartResponse({utterance: 'Не совсем поняла, могу я использовать этот номер для записи?', listen: true})
      }
      operatorPhrase = 'Я попытаюсь подключить оператора, чтобы он вам помог'
      return SmartResponse({nextState: 'operator'})
    }    
  }
})


addState({
  name: 'phoneNumberInput',
  onEnter: async (event) => {
    analyticsSendEvent('BookPhoneNumber')
    if (!getCustomData().voice) {
      return SmartResponse({utterance: 'Введите, пожалуйста, ваш номер телефона в формате +7xxxxxxxxxx', listen: true})
    }

    if (event.visitsCounter === 1) {
      return SmartResponse({utterance: 'Продиктуйте, пожалуйста, ваш номер телефона', listen: true})
    } else {
      return SmartResponse({listen: true})
    }
  },
  onUtterance: async (event) => {
    /* add handling for intents, which are appropriate in the middle of slot filling */
    if (event.intent === 'stop') {
      cleanFormData(formDoctorTime)
      return SmartResponse({utterance: 'Ясно, очень жаль. Могу помочь вам чем-то еще?', nextState: 'start', customData: {avatarPortalData: {inlineKeyboardButtons: startButton}}})
    }
    if (event.intent === 'operator') {
      fillPhoneSlotClear()
      return SmartResponse({utterance: `Я поняла что вы хотите поговорить с оператором, но давайте попробуем еще: я буду вводить по одной цифре, начиная с семи.`, listen: true})
    }
    if (event.intent === 'no' || event.intent === 'stop') {
      phoneNumberFailedCount += 1
      if (phoneNumberFailedCount === 1) {
        fillPhoneSlotClear()
        return SmartResponse({utterance: `Поняла, давайте попробуем еще раз, я буду вводить по одной цифре, начиная с семи.`, listen: true})
      } else {
        operatorPhrase = `Ясно. Сейчас попробую найти оператора, который сможет лучше помочь вам с вашей проблемой, одну секунду.`
        return SmartResponse({nextState: 'operator'})
      }
    } 

    /* do slot filling */
    if (!getCustomData().voice) {
      return SmartResponse({nextState: phoneNumberNextState})
      let match = phoneNumberRegexp.exec(event.text)
      if (match) {
        phone = match[0]
        return SmartResponse({nextState: phoneNumberNextState})
      } else {
        return SmartResponse({utterance: 'Номер должен быть в формате +7xxxxxxxxxx', listen: true})
      }
    }

    if (event.entities.systemNumber) {
      const utterance = fillPhoneSlot(event.entities.systemNumber)
      if (utterance === 'next state') {
        return SmartResponse({nextState: 'PhoneNumberConfirm'})
      } else if (utterance === 'repeat') {
        resultPhone = null
        listOfPhone = []
        return SmartResponse({ utterance: 'Простите, я сбилась, давайте сначала', listen: true })
      } else if (utterance === 'continue') {
        return SmartResponse({ utterance: `Ага, ${lastPhoneNumberDigits}`, listen: true })
      }
    }
    if (event.intent === 'repeat') {
      return SmartResponse({utterance: lastUtterance, listen: true})
    } else if (event.utteranceCounter < 4) {
      resultPhone = null
      listOfPhone = []
      return SmartResponse({ utterance: 'Простите, я сбилась, давайте сначала', listen: true })
    } else {
      operatorPhrase = 'У меня возникли проблемы, я переведу вас на оператора, и он сможет решить ваш вопрос'
      return SmartResponse({nextState: 'operator'})
    }

  },
});


addState({
  name: 'PhoneNumberConfirm',
  onEnter: async (event) => {
    analyticsSendEvent('PhoneNumberConfirm')
    return SmartResponse({utterance: `Итак, ваш номер телефона ${spacePhone}. Все верно?`, listen: true})
  },
  onUtterance: async (event) => {
    /* add handling for intents, which are appropriate in the middle of slot filling */
    if (event.intent === 'yes') {
      return SmartResponse({nextState: phoneNumberNextState})
    } else if (event.intent === 'repeat') {
        return SmartResponse({utterance: lastUtterance, listen: true})
    } else {
      phoneNumberFailedCount += 1
      if (phoneNumberFailedCount === 1) {
        fillPhoneSlotClear();
        return SmartResponse({utterance: `Поняла, давайте попробуем еще раз, я буду вводить по одной цифре, начиная с семи.`, nextState: 'phoneNumberInput'})
      } else {
        operatorPhrase = 'Я вас поняла. Сейчас попробую найти оператора, который сможет лучше помочь вам с вашей проблемой, одну секунду.'
        return SmartResponse({nextState: 'operator'}) /* go back to the same state and check if form is finally filled */
      }
    }
  },
});


addState({
  name: 'suggestBooking',
  onEnter: async (event) => {
    analyticsSendEvent('SuggestBooking')
    return SmartResponse({utterance: `Да у нас есть ${formDoctorTime.doctor.value}. Хотите, запишу вас к нему на прием?`, listen: true, customData: {avatarPortalData: {inlineKeyboardButtons: yesNoButtons}}})
    
  },
  onUtterance: async (event) => {
    /* add handling for intents, which are appropriate in the middle of slot filling */
    if (event.intent === 'yes') {
      fillFormData(formDoctorTime, event)
      return SmartResponse({nextState: 'booking'})
    } else if (event.intent === 'locations') {
      if (getCustomData().voice) {
        return SmartResponse({utterance: `У нас есть клиники по адресам ул Мытная дом 66 - метро Тульская, ул Большая Серпуховская дом 55 - метро Серпуховская и в Камергерском переулке дом 10 - это метро Цветной Бульвар. Так записать вас на прием?`, listen: true})
      } else {
        return SmartResponse({utterance: `У нас есть клиники по адресам: \n🏠 ул Мытная дом 66 (метро Тульская), \n🏠 ул Большая Серпуховская дом 55 (метро Серпуховская) \n🏠 Камергерский переулок дом 10 (метро Цветной Бульвар). \n\nТак записать вас на прием?`, listen: true})
      }
    } else if (event.intent === 'repeat') {
        return SmartResponse({utterance: lastUtterance, listen: true})
    } else {
      operatorPhrase = 'Я вас поняла. Сейчас попробую найти оператора, который сможет лучше помочь вам с вашей проблемой, одну секунду.'
      return SmartResponse({nextState: 'operator'}) /* go back to the same state and check if form is finally filled */
    }
  },
});


addState({
  name: 'BookName',
  onEnter: async (event) => {
    analyticsSendEvent('BookName')
    return SmartResponse({utterance: `И как к вам можно обращаться?`, listen: true})
  },
  onUtterance: async (event) => {
    /* add handling for intents, which are appropriate in the middle of slot filling */
    if (event.intent === 'no' || event.intent === 'stop' || event.intent === 'operator') {
      operatorPhrase = `Ясно. Сейчас попробую найти оператора, который сможет лучше помочь вам с вашей проблемой, одну секунду.`
      return SmartResponse({nextState: 'operator'})
    }
    if (event.entities.systemPerson) {
      name = event.entities.systemPerson[0].value
      existingVisits.push({doctor: formDoctorTime.doctor.value, time: dateTimeToVoice(formDoctorTime.preferrabeDay.value, formDoctorTime.preferrabeDay.valueRangeEnd)})
      analyticsSendEvent('Booked')
      if (!getCustomData().voice) {
        return SmartResponse({ utterance: `Спасибо, ${name}! Я сделала предварительную запись:\nВремя: ${dateTimeToVoice(formDoctorTime.preferrabeDay.value, formDoctorTime.preferrabeDay.valueRangeEnd)}\nУслуга: ${formDoctorTime.doctor.value}\nПожалуйста, убедитесь, что у вас нет симптомов ОРВИ, перед посещением, а также не забудьте паспорт и медицинский полис.\n\nМогу помочь чем-то еще?`, nextState: 'start', customData: {avatarPortalData: {inlineKeyboardButtons: startButton}}})
      } else {
        return SmartResponse({ utterance: `Спасибо, ${name}! Я записала ваш запрос и передала его нашим специалистам, они постараются подобрать время в удобном вам интервале и свяжутся с вами по факту записи. Могу помочь чем-то еще?`, nextState: 'start', customData: {avatarPortalData: {inlineKeyboardButtons: startButton}}})
      }
    } else if (event.utteranceCounter > 2) {
      name = event.text
      analyticsSendEvent('Booked')
      return SmartResponse({ utterance: 'Спасибо! Я записала ваш запрос и передала его нашим специалистам, они постараются подобрать время в удобном вам интервале и свяжутся с вами по факту записи. Могу помочь чем-то еще?', nextState: 'start', customData: {avatarPortalData: {inlineKeyboardButtons: startButton}}})
    } else {
      return SmartResponse({ utterance: 'Прошу прощения, не поняла', listen: true })
    }
  },
});

addState({
  name: 'CancelSelect',
  onEnter: async (event) => {
    analyticsSendEvent('CancelSelect')
    if (existingVisits.length === 0) {
      return SmartResponse({utterance: 'В базе ваших записей не обнаружено. Может быть, могу помочь чем-то еще?', nextState: 'start', customData: {avatarPortalData: {inlineKeyboardButtons: startButton}}})
    } else if (existingVisits.length === 1) {
      existingVisitToCancel = existingVisits[0]
      existingVisits = []
      return SmartResponse({nextState: 'CancelReason'})
    } else {
      let doctorList = ''
      let doctorButtons = []
      for (const visit of existingVisits) {
        doctorList += '\n- ' + visit.doctor + ' ' + visit.time
        doctorButtons.push(visit.doctor + ' ' + visit.time)
      }
      return SmartResponse({utterance: `Я нашла в базе ваши записи к следующим докторам: ${doctorList}\n\nКакую из них отменить?`, listen: true, customData: {avatarPortalData: {inlineKeyboardButtons: doctorButtons}}})
    }
  },
  onUtterance: async (event) => {
    if (event.intent === 'no' || event.intent === 'stop' || event.intent === 'operator') {
      operatorPhrase = `Ясно. Сейчас попробую найти оператора, который сможет лучше помочь вам с вашей проблемой, одну секунду.`
      return SmartResponse({nextState: 'operator'})
    } else if (event.intent === 'repeat') {
      return SmartResponse({utterance: lastUtterance, listen: true})
    } else if (event.entities.doctorType) {
      let doctorToCancel = event.entities.doctorType[0].value
      let leftVisits = []
      for (const visit of existingVisits) {
        if (visit.doctor != doctorToCancel) {
          leftVisits.push(visit)
        } else {
          existingVisitToCancel = visit
        }
      }
      if (leftVisits.length === existingVisits.length) {
        return SmartResponse({utterance: 'Хм, не могу найти этого доктора в списке записей, можете повторить?', listen: true})
      } else {
        existingVisits = leftVisits
        return SmartResponse({nextState: 'CancelReason'})
      }
    } else {
      return SmartResponse({ utterance: 'Прошу прощения, я вас не поняла, могу помочь чем-то еще?', nextState: 'start', customData: {avatarPortalData: {inlineKeyboardButtons: startButton}}})
    }
  },
});

addState({
  name: 'CancelReason',
  onEnter: async (event) => {
    analyticsSendEvent('CancelReason')
    return SmartResponse({utterance: `Я отменила вашу запись (${existingVisitToCancel.doctor} ${existingVisitToCancel.time}). Для улучшения качества обслуживания хотела бы вас спросить: а почему вы решили отменить свое посещение?`, listen: true, customData: {avatarPortalData: {inlineKeyboardButtons: ['Дорого', 'Не могу в это время', 'Проблема разрешилась']}}})
  },
  onUtterance: async (event) => {
    /* add handling for intents, which are appropriate in the middle of slot filling */
    if (event.intent === 'problemSolved') {
      return SmartResponse({utterance: 'Рада что удалось решить проблему. Запись отменила. Не болейте. Могу помочь чем-то еще?', nextState: 'start', customData: {avatarPortalData: {inlineKeyboardButtons: startButton}}})
    } else if (event.intent === 'expensive') {
      return SmartResponse({nextState: 'objectionExpensive'})
    } else if (event.intent === 'canVisitScheduledTime') {
      return SmartResponse({nextState: 'objectionCantVisit'})
    } else if (event.intent === 'no' || event.intent === 'stop' || event.intent === 'operator') {
      return SmartResponse({utterance: 'Ясно. Могу помочь чем-то еще?', nextState: 'start', customData: {avatarPortalData: {inlineKeyboardButtons: startButton}}})
    } else if (event.intent === 'repeat') {
      return SmartResponse({utterance: lastUtterance, listen: true})
    } else {
      cancelReason = event.text
      return SmartResponse({ utterance: 'Спасибо большое! Могу помочь чем-то еще?', nextState: 'start', customData: {avatarPortalData: {inlineKeyboardButtons: startButton}}})
    }
  },
});

addState({
  name: 'objectionExpensive',
  onEnter: async (event) => {
    analyticsSendEvent('objectionExpensive')
    return SmartResponse({utterance: `В качестве бонуса к первому визиту мы готовы сделать вам скидку 10% на первый прием в случае сохранения записи. Хотите воспользоватся?`, listen: true, customData: {avatarPortalData: {inlineKeyboardButtons: yesNoButtons}}})
  },
  onUtterance: async (event) => {
    /* add handling for intents, which are appropriate in the middle of slot filling */
    if (event.intent === 'yes') {
      existingVisits.push(existingVisitToCancel)
      return SmartResponse({utterance: 'Прекрасно! Я оставляю вашу запись, и скидка добавлена. Могу помочь чем-то еще?', nextState: 'start', customData: {avatarPortalData: {inlineKeyboardButtons: startButton}}})
    } else if (event.intent === 'no' || event.intent === 'stop' || event.intent === 'operator') {
      return SmartResponse({utterance: 'Ясно. Могу помочь чем-то еще?', nextState: 'start', customData: {avatarPortalData: {inlineKeyboardButtons: startButton}}})
    } else if (event.intent === 'repeat') {
      return SmartResponse({utterance: lastUtterance, listen: true})
    } else {
      return SmartResponse({ utterance: 'Что-что простите?', listen: true, customData: {avatarPortalData: {inlineKeyboardButtons: yesNoButtons}}})
    }
  },
});

addState({
  name: 'objectionCantVisit',
  onEnter: async (event) => {
    analyticsSendEvent('objectionCantVisit')
    return SmartResponse({utterance: `Очень жаль, может хотите перенести запись на другое время?`, listen: true, customData: {avatarPortalData: {inlineKeyboardButtons: yesNoButtons}}})
  },
  onUtterance: async (event) => {
    /* add handling for intents, which are appropriate in the middle of slot filling */
    if (event.intent === 'yes') {
      cleanFormData(formDoctorTime)
      formDoctorTime.doctor.value = existingVisitToCancel.doctor
      return SmartResponse({nextState: 'book'})
    } else if (event.intent === 'no' || event.intent === 'stop' || event.intent === 'operator') {
      return SmartResponse({utterance: 'Ясно. Могу помочь чем-то еще?', nextState: 'start', customData: {avatarPortalData: {inlineKeyboardButtons: startButton}}})
    } else if (event.intent === 'repeat') {
      return SmartResponse({utterance: lastUtterance, listen: true})
    } else {
      return SmartResponse({ utterance: 'Что-что простите?', listen: true, customData: {avatarPortalData: {inlineKeyboardButtons: yesNoButtons}}})
    }
  },
});

addState({
  name: 'operator',
  onEnter: async (event) => {
    analyticsSendEvent('Operator')
    if (!getCustomData().voice) {
      return SmartResponse({
        utterance: '(В реальном кейсе мы в этот момент бесшовно подключаем оператора, чтобы он смог помочь разобраться со сложной ситуацией. В демке же просто начнем сначала)\n\n\nДобрый день! Вас приветствует клиника Sacred Hearts, чем могу вам помочь?', 
        listen: true,
        nextState: 'start',
        customData: {avatarPortalData: {inlineKeyboardButtons: startButton}}})
    }
    return SmartResponse({utterance: operatorPhrase + '. В реальном разговоре мы бы подключили оператора к разговору.', nextState: 'doorway', customData: {isFinal: true}})
  },
  onUtterance: async (event) => {
    /* add handling for intents, which are appropriate in the middle of slot filling */
    if (event.intent === 'no' || event.intent === 'stop' || event.intent === 'operator') {
      return SmartResponse({utterance: `Ясно. Сейчас попробую найти оператора, который сможет лучше помочь вам с вашей проблемой, одну секунду.`, nextState: 'operator'})
    } else if (event.intent === 'repeat') {
      return SmartResponse({utterance: lastUtterance, listen: true})
    } else {
      cancelReason = event.text
      return SmartResponse({ utterance: 'Спасибо большое!', nextState: 'doorway', customData: {isFinal: true} })
    }
  },
});


addState({
  name: 'doorway',
  onEnter: async (event) => {
    analyticsSendEvent('Finish')
    /* Заканчиваем диалог*/
    return SmartResponse({ isFinal: true });
  },
});


/* Делаем 'start' начальным состоянием нашего диалога */
setStartState('start');