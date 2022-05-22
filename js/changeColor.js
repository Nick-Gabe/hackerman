const title = document.getElementById('title')
const header = document.querySelector('header')
const elements = Array.from(
    document.querySelectorAll('main > p, .code--pointer, #title, header')
)

const colors = [
    {
        text: 'rgb(173, 255, 47)',
        bg: '#121212'
    },
    {
        text: 'rgb(232, 235, 247)',
        bg: '#370606'
    },
    {
        text: 'rgb(161, 150, 217)',
        bg: '#EAEAEA'
    }
]

elements.forEach(x => x.style.transition = "color 1 s ease")

title.onclick = changeColor
title.style.color = colors[0].text

function changeColor() {
    const nextColor = (colors.findIndex(x => {
        return title.style.color.includes(x.text)
    }) + 1) % colors.length || 0
    
    const selectedColor = colors[nextColor]

    elements.forEach(elem => {
        elem.style.color = selectedColor.text
    })
    document.body.style.backgroundColor = selectedColor.bg
    header.style.backgroundColor = selectedColor.bg

}