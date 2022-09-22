// ==UserScript==
// @name         Jira Colored Labels
// @namespace    https://qoomon.github.io
// @version      1.0.0
// @updateURL    https://github.com/qoomon/userscript-jira-colored-labels/raw/main/jira-colored-labels.user.js
// @downloadURL  https://github.com/qoomon/userscript-jira-colored-labels/raw/main/jira-colored-labels.user.js
// @description  try to take over the world!
// @author       qoomonu
// @match        https://*.atlassian.net/jira/core/projects/*/board
// @match        https://*.atlassian.net/jira/core/projects/*
// @icon         https://www.atlassian.com/favicon.ico
// @grant        none
// ==/UserScript==

const labelsFieldName = 'Labels'
const labelsEmptyValue = 'None'

window.addEventListener('changestate', async () => {
    'use strict';

    if(![
      document.location.pathname.match(/^\/jira\/core\/projects\/[^/]+\/board$/),
    ].some(Boolean)) {
       console.debug('skip', document.location.pathname);
       return
    }

    const project = detectProject()
    console.debug('project:', project);

    const boardElement = await untilDefined(() => getBoardElement())
    console.debug('board element:', boardElement)

    await updateCards()

    new MutationObserver(async (mutations) => {
        const nodesAdded = mutations.some(mutation => mutation.addedNodes.length > 0)
        if(nodesAdded) await updateCards()
    }).observe(boardElement, { childList: true, subtree: true })

    async function updateCards() {
        const boardCards = getBoardCards()
        boardCards.filter(card => !card.element._coloredLabels).forEach(async card => {
            console.debug("update card element: ", card.key)
            card.element._coloredLabels = true

            if(project.type === 'company') {

                const labelElement = card.element.querySelector(`span[data-tooltip^="${labelsFieldName}:"].ghx-extra-field`)
                if(labelElement){
                    labelElement.parentNode.style.maxHeight = 'fit-content'

                    const labelContentElement = labelElement.querySelector('span.ghx-extra-field-content')

                    const labels = labelElement.getAttribute('data-tooltip').endsWith(`: ${labelsEmptyValue}`) ? [] : labelContentElement.innerText.split(', ')

                    if(labels.length) {
                        labelContentElement.innerText = ''
                        labelContentElement.style.cssText = `
                          display: flex;
                          flex-wrap: wrap;
                          gap: 4px;
                        `
                        labels.forEach(label => {
                            const spanElement = document.createElement('span')
                            spanElement.innerText = label
                            spanElement.style.cssText = `
                              color: white;
                              font-size: 10px;
                              font-weight: bold;
                              white-space: nowrap;
                              background-color: ${hashColor(label)};
                              border-radius: 48px;
                              padding: 3px 8px;
                              margin: 4px 0;
                            `
                            labelContentElement.appendChild(spanElement)
                        })
                    }
                }
            }
        })
    }

    // -------------------------------------------------------------------------

    function getBoardCards() {
        if(project.type === 'team') {
            const projectKey = document.location.pathname.match(/\/projects\/(?<project>[^/]+)\//).groups.project
            return [...document.querySelectorAll('div[data-rbd-draggable-id^="ISSUE::"]')].map(element => ({
                key: [...element.querySelectorAll('span')].find(e => e.innerText.startsWith(`${projectKey}-`)).innerText,
                element
            }))
        }
        if(project.type === 'company') {
            return [...document.querySelectorAll('.ghx-issue')].map(element => ({
                key: element.getAttribute('data-issue-key'),
                element
            }))
        }
    }

    function getBoardElement() {
        if(project.type === 'team') {
            return document.querySelector('#ak-main-content > div > div > div > div:last-child')
        }
        if(project.type === 'company') {
            return document.querySelector('#ghx-work')
        }
    }
})

function detectProject() {
    const project = {
        key: document.location.pathname.match(/\/projects\/(?<project>[^/]+)\//).groups.project
    }

    if(document.location.pathname.startsWith('/jira/core')) {
        project.type = 'team'
    }
    if(document.location.pathname.startsWith('/jira/software')) {
        project.type = 'company'
    }

    return project
}

async function untilDefined(fn) {
    return new Promise(resolve => {
        const interval = setInterval(() => {
            const result = fn()
            if (result != undefined) {
                clearInterval(interval)
                resolve(result)
            }
        }, 100)
        })
}

function hashColor(str) {
    const hash = BKDRHash(str)
    const hue = hash % 359
    const saturation = 50
    const lightness = 50

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

// from https://github.com/zenozeng/color-hash
function BKDRHash(str) {
    var seed = 131;
    var seed2 = 137;
    var hash = 0;
    // make hash more sensitive for short string like 'a', 'b', 'c'
    str += 'x';
    // Note: Number.MAX_SAFE_INTEGER equals 9007199254740991
    var MAX_SAFE_INTEGER = Math.floor(9007199254740991 / seed2);
    for(let i = 0; i < str.length; i++) {
        if(hash > MAX_SAFE_INTEGER) {
            hash = Math.floor(hash / seed2);
        }
        hash = hash * seed + str.charCodeAt(i);
    }
    return hash;
};


// -----------------------------------------------------------------------------

window.history.pushState = new Proxy(window.history.pushState, {
  apply: (target, thisArg, argArray) => {
    const result = target.apply(thisArg, argArray)
    window.dispatchEvent(new Event('pushstate'))
    window.dispatchEvent(new Event('changestate'))
    return result
  }
})

window.history.replaceState = new Proxy(window.history.replaceState, {
  apply: (target, thisArg, argArray) => {
    const result = target.apply(thisArg, argArray)
    window.dispatchEvent(new Event('replacestate'))
    window.dispatchEvent(new Event('changestate'))
    return result
  }
})

window.addEventListener('popstate', () => {
    window.dispatchEvent(new Event('changestate'));
})
