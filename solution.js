const axios = require('axios')
const cheerio = require('cheerio')
const fs = require('fs')

const baseUrl = 'https://www.bankmega.com'
const kreditCardSlug = '/promolainnya.php?'

console.log('this will take a second, we are still getting all the information....')

let json = {}
let subcatObj = {}
let totalPageObj = {}

let linkImgEachSubCatPagination = []
let allLinkImgs = []

//promise of all images promo
let promisseImgs = []

let countPromoPerCategory = []

//variable for promo detail
let listTitlePromo = []
let listAreaPromo = []
let periodePromoArr = []
let listImageSource = []

// // call url for each category promo without pagination (paralel)
fetchCategory(baseUrl + kreditCardSlug)
  .then((response) => {
    const $ = cheerio.load(response.data)

    //get all category dynamic at firstime
    const subcat = $('#subcatpromo').find('img').each((i, img) => {
      subcatObj[ img.attribs.id ] = []
      json[ img.attribs.id ] = []
    })

    const listCategory = Object.keys(subcatObj)

    const listLinkCategory = listCategory.map((category, index) => {
      const link = baseUrl + kreditCardSlug + '&subcat=' + Number(index + 1)
      return fetchPromoPerCategory(link)
    })
    return Promise.all(listLinkCategory)
  })
  .then((responses) => {
    for (let i = 0; i < responses.length; i++) {
      if (responses[ i ].status === 200) {
        const $ = cheerio.load(responses[ i ].data)

        const listCategory = Object.keys(subcatObj)

        //get the total page of each category promo from pagination title
        const pagination = $('.tablepaging').children('tbody').children('tr').children('td')

        $(pagination).each((index, item) => {
          const title = $(item).children('a').attr('title')
          const totalPageEachCategory = title.split('of ').pop()
          totalPageObj[ listCategory[ i ] ] = totalPageEachCategory
        })

        // push all promo urls that will scrap in all category of credit card (including pagination) to find image of each page (paralel)
        for (let j = 1; j <= totalPageObj[ listCategory[ i ] ]; j++) {
          const subcat = i + 1
          const linkImg = baseUrl + kreditCardSlug + '&page=' + j + '&subcat=' + subcat
          linkImgEachSubCatPagination.push(linkImg)
        }
      }
      else {
        console.log('error when scrapping category page')
      }
    }
  })
  .then(() => {
    let promissesAll = linkImgEachSubCatPagination.map((url) => (fetchPromoPerCategory(url)))
    return Promise.all(promissesAll) //call all page promo urls in all category (paralel) to find image of each page (paralel)
  })
  .then((responses) => {
    for (let i = 0; i < responses.length; i++) {
      if (responses[ i ].status === 200) {

        const $ = cheerio.load(responses[ i ].data)

        const selectedCategory = $('#subcatselected').children('img').attr('id')

        $('#promolain LI A').each((index, el) => {

          const href = $(el).attr('href').split('https://www.bankmega.com/').pop() //edge case, there are href of image that contain https://www.bankmega.com/
          subcatObj[ selectedCategory ].push(href)
        })

      }
      else {
        console.log('error when scrapping promo detail url')
      }
    }

    Object.keys(subcatObj).map((category) => {
      countPromoPerCategory.push(subcatObj[ category ].length) //hapus nanti
    })
  })
  .then(() => {
    const listCategory = Object.keys(subcatObj)

    listCategory.map((category) => {
      const listPromoEachCategory = subcatObj[ category ]

      listPromoEachCategory.map((slug) => {
        promisseImgs.push(fetchPromoDetail(baseUrl, slug))
        allLinkImgs.push(baseUrl + '/' + slug) // save all image promo urls to array
      })
    })

    return Promise.all(promisseImgs) //call all image promo urls in credit card (paralel)
  })
  .then((responses) => {
    for (let j = 0; j < responses.length; j++) {
      if (responses[ j ].status === 200) {

        const $ = cheerio.load(responses[ j ].data)

        //get detail info of each promo
        listTitlePromo.push($('.titleinside').children('h3').text())
        listAreaPromo.push($('.area').children('b').text())
        periodePromoArr.push($('.periode').children('b').text())
        listImageSource.push($('.keteranganinside').children('img').attr('src'))

        //create to object
        const obj = {}
        obj[ 'title' ] = listTitlePromo[ j ]
        obj[ 'area_promo' ] = listAreaPromo[ j ]
        obj[ 'periode_promo' ] = periodePromoArr[ j ]
        obj[ 'link_promo' ] = allLinkImgs[ j ]
        obj[ 'source_asset_image' ] = listImageSource[ j ]

        const listCategory = Object.keys(subcatObj)

        const rangeObj = {}

        rangeObj[ listCategory[ 0 ] ] = countPromoPerCategory[ 0 ]
        rangeObj[ listCategory[ 1 ] ] = rangeObj[ listCategory[ 0 ] ] + countPromoPerCategory[ 1 ]
        rangeObj[ listCategory[ 2 ] ] = rangeObj[ listCategory[ 1 ] ] + countPromoPerCategory[ 2 ]
        rangeObj[ listCategory[ 3 ] ] = rangeObj[ listCategory[ 2 ] ] + countPromoPerCategory[ 3 ]
        rangeObj[ listCategory[ 4 ] ] = rangeObj[ listCategory[ 3 ] ] + countPromoPerCategory[ 4 ]

        // //push object to the array of each category
        if (j + 1 <= rangeObj[ listCategory[ 0 ] ]) {
          json[ listCategory[ 0 ] ].push(obj)
        }
        else if (j + 1 > rangeObj[ listCategory[ 0 ] ] && j + 1 <= rangeObj[ listCategory[ 1 ] ]) {
          json[ listCategory[ 1 ] ].push(obj)
        }
        else if (j + 1 > rangeObj[ listCategory[ 1 ] ] && j + 1 <= rangeObj[ listCategory[ 2 ] ]) {
          json[ listCategory[ 2 ] ].push(obj)
        }
        else if (j + 1 > rangeObj[ listCategory[ 2 ] ] && j + 1 <= rangeObj[ listCategory[ 3 ] ]) {
          json[ listCategory[ 3 ] ].push(obj)
        }
        else if (j + 1 > rangeObj[ listCategory[ 4 ] ] && j + 1 <= rangeObj[ listCategory[ 5 ] ]) {
          json[ listCategory[ 4 ] ].push(obj)
        }
        else {
          json[ listCategory[ 5 ] ].push(obj)
        }
      }
      else {
        console.log('error when scraping ' + promissesAll[ i ])
      }
    }

    //save to json file
    fs.writeFileSync('solution.json', JSON.stringify(json, null, 2))

    //notification when done
    console.log('******************************************************************************')
    console.log('scrapping done, please check the result in solution.json')
  })

// for call the url first time
async function fetchCategory(baseUrl, kreditCardSlug) {
  const url = baseUrl + kreditCardSlug
  const response = await axios.get(url)

  return response
}

//for call url of each category include the pagination
async function fetchPromoPerCategory(link) {
  const url = link
  const response = await axios.get(url)

  return response
}


//for call url of image to show promo detail
async function fetchPromoDetail(baseUrl, linkImg) {

  const url = baseUrl + '/' + linkImg
  const response = await axios.get(url)

  return response
}
