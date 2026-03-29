import EmblaCarousel from 'embla-carousel'
import { addPrevNextBtnsClickHandlers } from './js/arrows.js'
import PhotoSwipeLightbox from 'photoswipe/lightbox'
import 'photoswipe/style.css'
import './css/styles.css'

const OPTIONS = { align: 'start', loop: true }

const emblaNode = document.querySelector('.embla')
const viewportNode = emblaNode.querySelector('.embla__viewport')
const prevBtnNode = emblaNode.querySelector('.embla__button--prev')
const nextBtnNode = emblaNode.querySelector('.embla__button--next')
const emblaApi = EmblaCarousel(viewportNode, OPTIONS)

const removePrevNextBtnsClickHandlers = addPrevNextBtnsClickHandlers(
  emblaApi,
  prevBtnNode,
  nextBtnNode
)


emblaApi.on('destroy', removePrevNextBtnsClickHandlers)

const lightbox = new PhotoSwipeLightbox({
  gallery: '.embla__container',
  children: 'a',
  pswpModule: () => import('photoswipe'),
  zoom: false,
  counter: false,
  showHideAnimationType: 'fade',
  padding: {top: 20, bottom: 20, left: 20, right: 20},
})

lightbox.on('uiRegister', function() {
  lightbox.pswp.ui.registerElement({
    name: 'custom-caption',
    order: 9,
    isButton: false,
    appendTo: 'root',
    html: 'Caption text',
    onInit: (el, pswp) => {
      lightbox.pswp.on('change', () => {
        const currSlideElement = lightbox.pswp.currSlide.data.element;
        let captionHTML = '';
        if (currSlideElement) {
          const hiddenCaption = currSlideElement.querySelector('.hidden-caption-content');
          if (hiddenCaption) {
            // get caption from element with class hidden-caption-content
            captionHTML = hiddenCaption.innerHTML;
          } else {
            // get caption from alt attribute
            captionHTML = currSlideElement.querySelector('img').getAttribute('alt');
          }
        }
        el.innerHTML = captionHTML || '';
      });
    }
  });
});

lightbox.init()
