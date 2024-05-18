import puppeteer from "puppeteer"
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let browser, page


export async function init() {
  browser?.close()
  try {
    browser = await puppeteer.launch({
      headless: false,//"new",
      args: [
        `--proxy-server=http://p.webshare.io:80`,
        '--no-sandbox',
        '--disable-web-security'
      ]
    })
    page = (await browser.pages()).pop()
    await page.authenticate({
      username: "blhotczd-rotate",
      password: "lwqme2cm6cuz"
    })

    await page.goto('https://www.bybit.com/').catch(e => { })
    console.log('title', await page.title())
    await page.waitForFunction(() => document.title.includes('Buy'), undefined, { timeout: 5000 })
    console.log('title', await page.title())
    await page.evaluate(() => window.stop())
    page.ready = true
  } catch (e) {
    console.log(e.message)
    await delay(3000)
    return await init()
  }
}

let initTimeout
// replace axios with browser fetch
export async function get(url, retries = 10) {
  if (retries === 0) {
    debugger
  }
  while (!page?.ready) {
    await delay(1000)
  }
  let response = await page.evaluate(url => {
    return fetch(url).then(r => r.json()).catch(e => { })
  }, url)

  if (!response) {
    page.ready = false
    clearTimeout(initTimeout)
    initTimeout = setTimeout(init, 1000)

    return await get(url, retries - 1)
  }

  return { status: 200, data: response }
}

export function close() {
  return browser.close()
  clearTimeout(initTimeout)
}



