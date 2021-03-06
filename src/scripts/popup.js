import './dependency/ef.min.js';
import './scanQR.js';
import * as i18n from './i18n.js';
import { debounce } from './utils.js';
import { KeyUtilities, OTPType } from './dependency/key-utilities.js';
import getServiceIconNames from './serviceIcon.js';
import { getPasswordInfo, getAccountInfos, saveAccountInfos } from './accountInfo.js';

i18n.render();

const serviceIconNames = getServiceIconNames();
const iconOnError = function (e) {
  e.src = '../icons/service/fallback.svg';
}
const containerIconOnError = function (e) {
  e.parentNode.removeChild(e);
}
const getSvgNameByIssuer = function (i) {
  switch (i) {
    case 'z.cn':
      return 'amazon';
    case 'Amazon Web Services':
      return 'aws';
    case '坚果云':
      return 'nutstore';
    case 'gitlab':
      return 'gitlab.com'
    case 'WordPress.com':
      return 'wordpress';
    default:
      return i.toLowerCase();
  }
}
/**
 * 
 * @param {string} issuer
 * @param {string} url https://www.amazon.com/
 */
const isIssuerMatchedUrl = function (issuer, url) {
  if (!issuer || !url) {
    return false;
  }
  const reg = /:\/\/(.*?)\//i;
  const res = reg.exec(url);
  if (!res || !res[1]) {
    return false;
  }
  const hostnameReversedArray = res[1].split('.').reverse();
  let issuerStr;
  switch (issuer) {
    case 'z.cn':
      issuerStr = 'amazon.cn';
      break;
    case 'Amazon Web Services':
      issuerStr = 'aws.amazon.com';
      break;
    case 'Keeper':
      issuerStr = 'keepersecurity.com';
      break;
    case 'Microsoft':
      issuerStr = 'live.com';
      break;
    case 'Discord':
      issuerStr = 'discordapp.com';
      break;
    default:
      issuerStr = '';
      break;
  }

  if (issuerStr) {
    if (hostnameReversedArray.join('.').indexOf(issuerStr.split('.').reverse().join('.')) === 0) {
      return true;
    } else {
      return false;
    }
  } else {
    if (hostnameReversedArray.findIndex(e => e === issuer.toLowerCase()) >= 0) {
      return true;
    } else {
      return false;
    }
  }
}
const isContainerMatched = function (account, tab) {
  if (!account && tab === 'firefox-default') {
    return true;
  }
  if (account === tab) {
    return true;
  }
  return false;
}

const isVisible = function (elem) {
  return !!(elem.offsetWidth || elem.offsetHeight || elem.getClientRects().length);
};
const toggleAccountsLess = document.querySelector('.toggleAccounts[data-type=less]');
const toggleAccountsMore = document.querySelector('.toggleAccounts[data-type=more]');
const popupSearchInput = document.querySelector('#popupSearchInput');

ef.inform();
const otpContainer = new (ef.t`
>div.container
  >div.columns
    +otppoint
  >div.column.col-12.mt-1
`)();

const simpleMemoized = (fn) => {
  let cache = undefined;
  return function() {
    if (cache === undefined) {
      cache = fn();
    }
    return cache;
  }
};
const template_totp = ef.t`
>div.column.col-12.mt-1.account-item.{{deleteModeClassName}} #accountItem
  #data-issuer = {{issuer}}
  #data-container-name = {{container}}
  #data-account={{account}}
  #data-flag = {{flag}}
  >div.danger-zone
    >div.delete-account-btn
      @click = deleteAccount
  >div.popup-card-wrapper
    -deletePromptDialog
    >div.card.popup-card
      >div.popup-header.popup-text
        >span.issuer
          .{{issuer}}
        >span.account
          .{{account}}
        >span.container
          #style = color:{{containerColorCode}}
          .{{container}}
      >div.popup-content
        >div.popup-row
          >a.popup-left
            #href = /options/tokens.html?index={{index}}
            #target = _blank
            >img.popup-icon.issuer-icon
              #onerror = iconOnError(this)
              #src = ../icons/service/{{issuerIcon}}.svg
          >div.popup-row-item
            >span
              #href = javascript:void(0);
              #class = {{otpKeyClassName}}
              .{{OTP}}
              -copySuccessMessage
              >i.popup-icon.icon-copy
                @click.stop = copyOtp
          >div.popup-right.container-icon-box
            #style = display:{{containerIconDisplay}}
            #data-color = {{containerColor}}
            >img.popup-icon.container-icon
              #style = fill:{{containerColorCode}}
              #onerror = containerIconOnError(this)
              #src = {{containerIcon}}
      >progress.progress
        #max={{progress_max}}
        %value={{progress}}
`;

const template_copy_success = ef.t`
>div.copy-success-message
  @animationend.stop = onAnimationEnd
  >svg
    #xmlns = http://www.w3.org/2000/svg
    #version = 1.2
    #viewBox = 0 0 16 20
    >path.checkmark
      #d = M2 10 L 6 14 14 4
  >span
    .{{copiedMessage}}
`;
const template_delete_prompt_dialog = ef.t`
>div.delete-prompt-dialog
  #style = display: {{styles.display}};
  >div.dialog-shadow
  >div.dialog
    >div.message
      .{{i18n_message}}
    >div.buttons
      >button.btn-sure
        @click=onSure
        .{{i18n_sure}}
      >button.btn-cancel
        @click=onCancel
        .{{i18n_cancel}}
`;

function getOtpType(issuer) {
  if (/steam/i.test(issuer)) {
    return OTPType.steam;
  } else {
    return OTPType.totp;
  }
}

otpContainer.$mount({ target: document.getElementById('otpContainer'), option: 'replace' })
var otpStoreInterval = []
function addOTP(issuer, containerObj = {}, key, expiry = 30, code_length = 6, option = {}) {
  var otpKey;
  var otpKeyClassName = 'popup-link';
  try {
    otpKey = KeyUtilities.generate(getOtpType(issuer), key, code_length, expiry);
  } catch (error) {
    console.error(error);
    otpKey = 'ERROR';
    otpKeyClassName = 'popup-link-error'
  }

  const id = otpContainer.otppoint.push(new template_totp({
    $data: {
      i18n_Copy: 'Copy',
      i18n_Edit: 'Edit',
      OTP: otpKey,
      account: option.account,
      issuer: issuer || '',
      issuerIcon: serviceIconNames.find(e => getSvgNameByIssuer(issuer).indexOf(e) >= 0) || 'fallback',
      otpKeyClassName: otpKeyClassName,
      container: containerObj.name || '',
      containerIcon: containerObj.iconUrl,
      containerIconDisplay: containerObj.iconUrl ? 'block' : 'none',
      containerColorCode: containerObj.colorCode,
      containerColor: containerObj.color,
      progress_max: expiry,
      progress: expiry - (Math.round(new Date().getTime() / 1000.0) % expiry),
      index: option.index,
      flag: option.flag,

      deleteModeClassName: '',
    },
    $methods: {
      copyOtp({ state, e }) {
        navigator
          .clipboard
          .writeText(state.$data.OTP)
          .then(() => {
            const { parentNode } = e.target;
            mountCopySuccessMessage(state, parentNode);
          });
      },
      deleteAccount({state, e}) {
        if (!state.deletePromptDialog) {
          state.deletePromptDialog = initDeletePromptDialog();
        } else {
          state.deletePromptDialog.$methods.setDisplay(state.deletePromptDialog, 'block');
        }
      }
    }
  })) - 1;
  if (otpKey !== 'ERROR') {
    otpStoreInterval.push(setInterval(async function () {
      otpContainer.otppoint[id].$data.OTP = KeyUtilities.generate(getOtpType(issuer), key, code_length, expiry)
      otpContainer.otppoint[id].$data.progress = expiry - (Math.round(new Date().getTime() / 1000.0) % expiry)
    }, 500))
  }
}
function clearOTP() {
  for (id in otpStoreInterval) {
    clearInterval(otpStoreInterval[id])
  }
  otpContainer.otppoint.empty()
  otpStoreInterval.empty()
}

const handleListItemFilter = function () {
  const isMore = isVisible(toggleAccountsLess) || (!isVisible(toggleAccountsLess) && !isVisible(toggleAccountsMore));
  const keyword = (popupSearchInput.value.trim() || '').toLowerCase();
  const domList = document.querySelectorAll('.account-item');
  [...domList].forEach(e => {
    const data = e.dataset;
    if (
      [data.issuer || '', data.containerName || '', data.account || ''].some(str => str.toLowerCase().indexOf(keyword) >= 0)
      &&
      (isMore || data.flag === 'matched')
    ) {
      e.style.display = 'block';
    } else {
      e.style.display = 'none';
    }
  })
}

function initSearch() {
  popupSearchInput.addEventListener('input',
    debounce(handleListItemFilter, {
      wait: 300,
      trailing: true,
      head: false,
    })
  );
}

function initMoreOrLess() {
  toggleAccountsLess.addEventListener('click', e => {
    toggleAccountsLess.style.display = 'none';
    toggleAccountsMore.style.display = 'block';
    handleListItemFilter();
  });
  toggleAccountsMore.addEventListener('click', e => {
    toggleAccountsLess.style.display = 'block';
    toggleAccountsMore.style.display = 'none';
    handleListItemFilter();
  });
}

function autoFillButtonInit() {
  document.getElementById('autofillOTPForm').addEventListener('click', async () => {
    const tabInfo = await browser.tabs.query({ active: true, currentWindow: true })
    await browser.tabs.executeScript(
      tabInfo[0].id,
      {
        file: '/scripts/content/manualCopy.js'
      }
    )
    if (/android/i.test(navigator.userAgent)) {
      const tabs = await browser.tabs.query({})
      const tab = tabs.find((tab) => tab.url.indexOf('popup.html') >= 0)
      if (tab) {
        browser.tabs.remove(tab.id)
      }
    }
  });
}

function otpKeyClickInit() {
  document.querySelector('body').addEventListener('click', async (event) => {
    const e = event.target;
    if (!([...document.querySelectorAll('.popup-row-item>span')].some(el => el === e))) {
      return;
    }
    if (!e.innerText) {
      return;
    }
    await browser.storage.local.set({
      tempKey: e.innerText,
    });

    const tabInfo = await browser.tabs.query({ active: true, currentWindow: true })
    await browser.tabs.executeScript(
      tabInfo[0].id,
      {
        file: '/scripts/content/fillKey.js'
      }
    );
    await browser.storage.local.remove('tempKey');

    if (/android/i.test(navigator.userAgent)) {
      const tabs = await browser.tabs.query({})
      const tab = tabs.find((tab) => tab.url.indexOf('popup.html') >= 0)
      if (tab) {
        browser.tabs.remove(tab.id)
      }
    }

  });
}

(async function () {
  const passwordInfo = await getPasswordInfo();
  if (passwordInfo.isEncrypted && !passwordInfo.password) {
    const errorDom = document.createElement('div');
    errorDom.setAttribute('class', 'popup-error');
    errorDom.innerText = i18n.getMessage('popup_data_encrypted');
    document.body.appendChild(errorDom);
    return;
  }

  const [ accountInfos, contextualIdentities, tabInfos ] = await Promise.all([getAccountInfos(passwordInfo), browser.contextualIdentities.query({}), browser.tabs.query({ active: true, currentWindow: true })]);
  const tabInfo = tabInfos[0];
  if (!accountInfos || !accountInfos.length) {
    const emptyDom = document.createElement('div');
    emptyDom.setAttribute('class', 'popup-empty');
    emptyDom.innerHTML = '<img src="../icons/options/starfleet.svg"/><div>Live long and prosper</div>';
    document.body.appendChild(emptyDom);
    return;
  }
  let hasMatch = false;

  accountInfos.forEach((e, i) => {
    const isMatch = isIssuerMatchedUrl(e.localIssuer, tabInfo.url) && isContainerMatched(e.containerAssign, tabInfo.cookieStoreId);
    if (isMatch) {
      hasMatch = true;
    }
    addOTP(
      e.localIssuer,
      contextualIdentities.find(el => el.cookieStoreId === e.containerAssign),
      e.localSecretToken,
      e.localOTPPeriod,
      e.localOTPDigits,
      {
        index: i,
        flag: isMatch ? 'matched' : 'other',
        account: e.localAccountName
      }
    )
  })
  ef.exec();
  if (hasMatch && !(accountInfos.length === 1)) {
    toggleAccountsMore.style.display = 'block';
    [...document.querySelectorAll('.account-item[data-flag=other]')].forEach(e => {
      e.style.display = 'none';
    });
    initMoreOrLess();
  } else {
    toggleAccountsMore.style.display = 'none';
  }

  initSearch();
  autoFillButtonInit();
  otpKeyClickInit();
})();

document.getElementById("popupClearSearch").addEventListener("click", clearSearch);

function clearSearch() {
  const clearPopupSearch = document.querySelector('[name=popupSearch]')
  clearPopupSearch.value = ""
  const event = new Event('input')
  popupSearchInput.dispatchEvent(event)
};

function mountCopySuccessMessage(component, rowItem) {
  if (component.copySuccessMessage) {
    return;
  }

  const { top } = rowItem.getBoundingClientRect();
  component.copySuccessMessage = new template_copy_success({
    $data: {
      style: top > 28 ? 'top: -28px;' : 'top: calc(100% + 4px);',
      copiedMessage: i18n.getMessage('popup_otp_copied')
    },
    $methods: {
      onAnimationEnd({ e, state }) {
        if (e.target === state.$element) {
          state.$umount();
        }
      }
    }
  });
}

window.onscroll = function() {scrollFunction()};

function scrollFunction() {
  if (document.documentElement.scrollTop > 100) {
    document.getElementById("btnToTop").style.display = "block";
  } else {
    document.getElementById("btnToTop").style.display = "none";
  }
}

function topFunction() {
  document.documentElement.scrollTop = 0;
} 

document.getElementById("btnToTop").addEventListener("click", topFunction);

popupSearchInput.addEventListener("focus", ()=> {
  toggleAccountsMore.click();
})

document.getElementById('delAccounts').addEventListener('click', (event) => {
  event.preventDefault();
  const accounts = otpContainer.otppoint;
  accounts.forEach((account) => {
    if (account.$data.deleteModeClassName === 'delete-mode-enter') {
      account.$data.deleteModeClassName = 'delete-mode-leave';
      if (account.deletePromptDialog) {
        account.deletePromptDialog.$methods.setDisplay(account.deletePromptDialog, 'none');
      }
    } else {
      account.$data.deleteModeClassName = 'delete-mode-enter';
    }
  });
});

function initDeletePromptDialog() {
  return new template_delete_prompt_dialog({
    $data: {
      i18n_sure: i18n.getMessage('sure'),
      i18n_cancel: i18n.getMessage('cancel'),
      i18n_message: i18n.getMessage('popup_delete_message'),
      styles: {
        display: 'block'
      }
    },
    $methods: {
      onCancel({state}) {
        state.$methods.setDisplay(state, 'none');
      },
      async onSure({state}) {
        const parentState = state.$parent;
        const { index } = parentState.$data;

        const accountInfos = await getAccountInfos();
        accountInfos.splice(index, 1);
        saveAccountInfos(accountInfos);
        parentState.$umount();
        clearInterval(otpStoreInterval[index]);
        otpStoreInterval.splice(index, 1);
      },
      setDisplay(state, value) {
        state.$data.styles.display = value;
      }
    }
  });
}

browser.storage.onChanged.addListener((changes, areaName)=> {if (changes.accountInfos && areaName === "local") {location.reload()}});