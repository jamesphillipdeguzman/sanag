import React, { useState } from 'react';
import { Satellite, Globe, ExternalLink, MapPin, Compass, ArrowUpRight } from 'lucide-react';
import { APP_VERSION } from './Navbar';

/** Simplified Panay Island outline path (400×400 viewBox, derived from GeoJSON boundaries) */
const PANAY_PATH = "M183.2,125.1L181.7,126.4L182.5,131.0L176.2,133.0L170.9,132.0L168.4,135.0L151.3,134.7L150.2,126.7L152.6,124.2L151.9,120.2L155.0,117.2L161.9,115.9L167.2,117.4L172.1,115.0L175.9,122.9L181.5,123.2L183.2,125.1ZM143.5,101.7L145.9,107.3L153.1,110.5L155.0,117.6L151.9,120.2L152.6,124.2L150.2,126.7L151.9,133.5L149.8,135.5L150.0,139.8L142.7,146.4L135.2,141.1L141.0,131.8L141.5,127.5L137.6,127.5L133.0,120.7L136.3,114.0L135.5,108.8L138.8,103.2L143.5,101.7ZM138.9,92.7L143.1,102.1L139.1,102.9L135.5,108.8L136.4,113.8L133.6,120.6L128.3,121.7L122.6,116.1L128.3,106.8L127.3,98.1L133.8,90.8L138.9,92.7ZM149.0,101.2L155.4,108.0L159.6,105.7L159.9,106.9L160.4,104.8L161.6,103.8L166.8,105.8L166.6,108.1L171.2,111.7L171.3,114.2L168.4,114.4L165.0,110.5L160.7,110.5L160.5,113.4L162.9,116.2L155.2,117.4L153.1,110.5L145.9,107.3L143.7,103.6L148.5,103.2L149.0,101.2ZM192.4,113.6L194.2,119.4L189.9,118.0L187.7,121.1L184.0,121.0L183.2,125.1L181.5,123.2L177.1,123.7L171.7,114.8L174.5,110.0L173.5,107.5L192.4,113.6ZM50.8,52.8L34.2,53.5L26.5,59.5L23.2,58.9L19.4,65.5L10.9,67.2L19.7,56.4L22.2,47.8L19.1,43.3L21.3,36.7L26.4,42.2L41.2,46.7L50.8,52.8ZM105.5,55.6L100.2,81.4L104.2,92.5L103.4,95.9L96.2,98.4L87.2,97.5L86.5,92.7L93.6,83.2L92.4,74.7L88.9,71.3L89.1,69.0L82.1,67.4L76.7,63.2L74.0,57.5L74.6,52.9L90.9,52.7L99.9,57.3L105.5,55.6ZM152.6,87.6L150.2,91.0L147.8,89.3L145.9,91.7L143.6,88.5L138.9,92.7L135.0,90.4L136.4,82.0L140.7,78.6L141.9,73.1L148.0,75.6L149.2,77.9L149.3,80.0L148.5,76.8L146.3,75.5L148.3,78.0L147.8,80.6L152.6,87.6ZM135.7,85.6L135.3,90.0L132.3,92.8L121.1,88.6L128.1,81.5L135.7,85.6ZM137.4,143.6L134.1,155.0L124.5,165.1L111.7,172.3L99.7,173.4L112.4,159.2L114.9,152.5L114.6,140.2L118.0,133.8L123.6,128.7L130.2,129.8L132.7,126.6L136.1,125.7L137.6,127.5L141.5,127.5L141.0,131.8L135.2,140.9L137.4,143.6ZM123.3,113.2L122.9,117.2L128.3,121.7L133.0,120.7L136.1,125.7L132.7,126.6L130.2,129.8L123.6,128.7L118.0,133.8L114.3,142.2L114.3,155.5L109.4,163.7L99.7,173.4L95.6,166.6L97.9,157.1L96.6,154.2L91.8,152.4L90.4,142.3L83.7,136.8L84.0,128.2L88.5,121.4L123.3,113.2ZM130.1,73.1L129.9,75.2L127.1,74.1L125.9,75.7L128.3,78.3L128.0,81.7L121.1,88.6L103.1,89.6L108.5,86.9L111.4,76.3L118.4,71.9L119.9,68.7L130.1,73.1ZM26.6,13.9L32.1,12.2L31.2,13.9L31.8,18.8L33.7,22.2L36.9,22.4L35.7,25.8L33.3,26.0L31.1,20.8L28.5,17.8L27.4,17.1L26.7,15.9L26.6,13.9ZM38.6,26.2L44.1,34.7L46.2,42.3L52.7,53.4L41.2,46.7L26.4,42.2L21.0,36.2L36.8,31.2L38.6,26.2ZM121.1,88.6L131.3,92.8L127.3,98.1L128.5,105.8L126.0,111.5L116.5,115.7L88.5,121.4L84.9,115.8L87.3,106.8L85.6,101.5L85.8,95.2L88.6,97.8L99.4,98.0L103.4,95.9L103.1,89.6L121.1,88.6ZM75.4,51.8L74.0,57.5L77.2,63.8L73.1,64.3L52.9,53.8L38.6,26.2L45.9,32.0L49.8,32.3L62.8,45.9L75.4,51.8ZM57.6,372.5L40.5,386.7L40.6,385.0L31.2,381.2L28.1,377.1L29.7,371.0L47.6,373.3L51.7,372.6L53.3,370.2L57.6,372.5ZM95.6,166.6L102.7,181.6L101.1,189.2L84.3,192.3L79.5,195.6L77.6,201.5L74.3,203.1L69.9,209.7L65.4,206.2L59.2,207.7L58.5,200.1L63.2,193.9L62.0,189.4L62.3,188.2L67.9,188.8L70.1,185.0L73.6,184.6L82.8,169.7L89.7,170.7L91.1,165.8L95.6,166.6ZM110.0,215.6L96.8,219.6L86.5,235.2L80.6,237.7L77.5,235.6L77.3,240.5L73.7,244.2L72.4,249.7L67.3,250.8L59.2,247.9L59.9,242.9L63.5,239.4L60.4,228.9L68.7,227.8L75.2,230.2L85.8,216.0L88.5,208.8L86.7,207.9L88.2,207.6L88.1,203.9L89.4,205.2L90.1,202.4L95.1,198.4L100.2,197.6L103.1,208.0L110.0,215.6ZM95.6,166.6L80.4,164.3L73.3,161.1L69.8,163.0L65.0,162.5L65.6,158.6L62.5,150.5L65.0,140.8L62.9,136.6L68.3,134.8L71.1,129.2L76.7,125.1L86.1,124.8L84.0,128.2L83.7,136.8L91.2,143.5L92.0,152.7L97.0,154.7L98.4,158.8L95.6,166.6ZM55.9,343.8L52.2,372.0L39.2,373.3L29.7,371.0L30.6,367.8L28.6,363.6L30.8,363.6L37.7,356.2L41.7,344.0L55.9,343.8ZM48.7,306.8L57.8,314.4L65.6,316.0L68.4,320.1L61.8,333.7L58.7,335.7L56.5,343.8L46.3,344.7L41.7,344.0L44.7,324.8L40.3,312.7L44.1,306.7L48.7,306.8ZM101.1,189.2L100.2,197.6L96.7,197.6L90.1,202.4L89.2,205.2L88.1,203.9L88.2,207.6L86.7,207.9L88.5,208.8L85.8,216.0L75.2,230.2L68.7,227.8L60.4,228.9L59.2,207.7L65.4,206.2L69.9,209.7L74.3,203.1L77.6,201.5L79.5,195.6L84.3,192.3L101.1,189.2ZM50.8,52.8L54.0,58.4L49.8,71.4L29.5,66.4L18.1,69.3L10.8,67.4L19.4,65.5L23.2,58.9L26.5,59.5L34.2,53.5L50.8,52.8ZM52.7,53.4L73.1,64.3L77.2,63.8L82.1,67.4L89.1,69.0L93.4,78.5L92.7,85.7L90.4,88.1L82.2,87.0L80.1,89.5L74.5,89.0L74.8,80.8L68.5,74.0L66.0,72.9L61.3,74.8L55.5,72.4L53.2,73.9L49.8,71.4L54.0,58.4L52.7,53.4ZM67.3,250.8L73.6,261.9L68.7,276.2L62.6,279.2L55.0,276.3L45.0,277.9L41.8,276.8L46.1,263.0L59.2,247.9L67.3,250.8ZM43.7,291.3L45.2,296.1L44.2,302.5L48.6,304.3L48.7,306.8L44.1,306.7L40.3,312.8L36.6,308.8L33.4,308.2L30.8,302.6L37.2,292.0L37.4,288.4L43.7,291.3ZM128.1,256.9L130.9,262.7L127.2,265.4L124.2,264.6L120.8,268.0L120.2,272.4L115.1,271.7L116.2,276.0L114.6,279.9L111.1,282.5L106.1,281.6L100.2,286.0L98.6,293.2L85.4,290.1L75.3,293.6L62.1,291.6L58.9,283.1L54.8,282.3L55.0,276.3L62.6,279.2L66.5,278.0L71.8,269.1L78.3,265.2L83.1,256.8L101.0,245.3L103.9,245.2L128.1,256.9ZM90.4,88.1L85.5,96.2L87.3,106.8L84.9,115.8L88.2,123.3L86.9,124.9L76.7,125.1L71.2,129.3L69.5,120.6L75.3,95.4L74.1,88.7L78.4,89.9L82.2,87.0L90.4,88.1ZM98.6,293.2L93.7,304.5L88.5,305.6L68.4,320.1L65.6,316.0L57.8,314.4L50.3,308.8L47.5,306.3L48.6,304.3L44.2,302.5L43.7,299.6L45.6,285.6L50.9,285.1L52.9,282.3L58.9,283.1L62.1,291.6L75.3,293.6L85.4,290.1L98.6,293.2ZM91.1,165.8L89.7,170.7L85.4,169.2L81.7,170.5L81.7,173.7L78.9,173.8L79.8,175.3L73.6,184.6L70.1,185.0L67.9,188.8L62.3,188.3L63.0,185.4L56.8,176.4L59.2,171.3L64.2,167.0L65.0,162.5L69.8,163.0L73.3,161.1L80.4,164.3L91.1,165.8ZM127.1,235.9L130.9,243.5L128.1,256.9L101.9,245.0L83.1,256.8L77.7,265.8L71.6,269.0L73.6,261.9L67.3,250.8L72.4,249.7L73.7,244.2L77.3,240.5L77.5,235.6L80.6,237.7L88.3,233.7L92.0,225.8L98.3,218.5L110.0,215.6L127.1,235.9ZM239.6,165.9L245.3,169.7L253.2,171.1L256.0,169.7L260.5,172.0L261.2,175.3L263.4,175.3L268.4,181.7L263.8,186.8L261.1,185.8L258.4,180.6L252.6,183.4L250.5,182.1L249.3,177.6L240.8,176.5L230.2,178.2L217.4,175.0L214.7,172.5L217.0,169.1L213.1,167.5L214.0,164.0L225.1,165.6L231.6,168.7L236.7,169.0L239.6,165.9ZM235.9,160.0L239.6,165.9L236.7,169.0L231.6,168.7L225.1,165.6L214.0,164.0L211.7,160.7L216.1,152.8L221.9,152.5L224.6,149.4L233.7,147.3L236.9,152.6L235.9,160.0ZM211.7,160.7L214.0,164.0L213.1,167.5L217.1,169.3L214.6,171.9L216.1,174.1L213.3,177.8L212.5,183.6L195.5,186.7L196.7,182.9L190.0,171.9L194.5,170.1L199.1,163.1L211.7,160.7ZM261.1,185.8L266.7,187.6L268.3,191.3L262.6,201.0L253.6,201.4L246.7,203.9L247.2,200.2L243.1,193.6L237.6,194.9L235.9,193.1L231.5,193.6L226.3,197.0L214.6,197.7L203.8,191.5L208.2,184.3L212.5,183.6L213.3,177.8L216.9,174.0L230.2,178.2L240.8,176.5L249.3,177.6L250.5,182.1L252.6,183.4L258.4,180.6L261.1,185.8ZM215.7,118.2L224.8,120.3L226.5,119.0L233.5,125.5L231.0,128.9L232.3,132.8L219.4,132.4L217.9,130.2L212.2,129.1L208.4,124.3L212.2,120.0L211.2,117.8L208.2,118.2L209.6,117.1L208.6,114.8L211.4,113.7L210.6,112.4L212.3,112.0L212.6,115.9L215.7,118.2ZM182.7,134.2L178.7,137.4L183.8,142.6L181.5,144.3L183.9,148.7L188.3,150.6L188.1,156.7L192.6,156.3L199.1,163.1L194.5,170.1L190.9,171.4L179.1,164.7L141.3,165.5L136.9,168.8L129.5,184.6L100.5,195.6L102.7,181.6L100.0,173.6L111.7,172.3L124.5,165.1L134.1,155.0L137.7,143.0L142.7,146.4L150.0,139.8L151.3,134.7L168.4,135.0L170.9,132.0L176.1,133.0L182.5,131.0L182.7,134.2ZM256.1,149.0L267.7,158.0L271.0,155.9L274.8,156.3L285.2,162.3L283.7,169.5L286.4,175.6L277.1,178.5L273.7,177.8L268.1,180.9L263.4,175.3L261.2,175.3L260.2,171.9L256.0,169.7L253.2,171.1L245.3,169.7L244.4,167.8L238.2,165.9L239.4,154.8L242.0,152.9L240.0,149.4L244.7,151.1L256.1,149.0ZM211.0,136.0L208.2,140.8L208.7,147.0L205.3,149.4L206.1,152.6L199.2,159.0L199.1,163.1L192.6,156.3L188.1,156.7L188.3,150.6L183.9,148.7L181.5,144.3L183.8,142.6L178.7,137.4L182.7,134.2L189.3,137.4L204.8,135.1L211.0,136.0ZM272.8,133.9L267.4,131.8L268.3,129.2L265.8,127.6L262.1,130.4L252.2,131.8L249.2,134.0L245.5,134.0L246.2,131.3L244.2,132.3L242.9,129.3L241.2,129.6L242.4,126.2L247.2,124.6L246.3,122.7L242.8,123.0L242.5,118.1L251.1,104.2L257.7,103.9L256.6,106.5L264.4,113.4L266.1,119.8L270.0,118.9L282.8,125.6L276.9,128.8L272.8,133.9ZM243.0,130.2L244.2,132.3L246.2,131.4L245.5,134.0L252.1,135.1L255.5,139.5L256.1,149.0L244.7,151.1L240.0,149.4L242.0,152.9L239.4,154.8L237.4,163.1L235.9,160.0L236.9,152.6L230.2,141.3L232.1,138.6L230.5,136.7L232.2,133.6L237.2,133.9L243.0,130.2ZM318.5,131.8L310.7,143.0L311.5,152.0L305.6,154.6L303.3,154.9L298.4,147.2L289.0,144.4L284.1,137.9L285.2,134.5L297.3,133.4L324.4,119.0L321.4,126.0L318.8,127.0L318.5,131.8ZM272.8,133.9L273.8,137.5L270.8,137.6L275.4,139.7L272.6,140.2L272.8,142.0L270.2,143.6L273.0,143.8L271.9,145.5L277.3,145.1L276.1,147.5L279.0,153.5L287.7,160.0L285.2,162.3L274.8,156.3L271.0,155.9L267.7,158.0L256.1,149.0L255.5,139.5L249.2,134.0L252.2,131.8L262.1,130.4L265.0,127.6L268.3,129.2L267.5,131.9L272.8,133.9ZM284.9,135.8L284.1,137.9L289.0,144.4L298.4,147.2L303.3,154.9L287.7,160.0L279.0,153.5L275.9,144.5L279.6,140.5L279.0,133.8L284.9,135.8ZM208.4,124.3L212.2,129.1L217.9,130.2L218.8,132.2L216.5,136.1L204.8,135.1L189.3,137.4L181.7,133.6L181.7,126.4L184.0,121.0L187.7,121.1L189.9,118.0L193.5,119.7L193.9,117.1L196.3,117.6L197.4,121.7L194.7,126.0L195.0,127.4L197.7,125.1L208.4,124.3ZM232.3,132.8L230.2,141.3L233.7,147.3L224.6,149.4L221.9,152.5L216.1,152.8L211.7,160.7L199.1,163.1L199.2,159.0L206.1,152.6L205.3,149.4L208.7,147.0L208.2,140.8L211.0,136.0L216.5,136.1L218.8,132.2L232.3,132.8ZM190.9,171.4L196.7,182.9L194.7,185.8L195.6,187.6L189.8,191.0L190.6,194.0L187.2,196.8L187.4,199.3L177.5,202.3L174.1,205.0L163.1,201.6L148.8,202.3L131.4,194.1L110.0,215.6L103.1,208.0L100.5,195.6L129.5,184.6L136.9,168.8L140.3,165.9L179.1,164.7L190.9,171.4ZM311.3,195.7L311.5,199.0L316.2,200.4L317.1,205.3L320.0,208.2L323.7,208.8L323.1,212.2L319.0,211.6L320.0,210.3L317.5,207.9L310.5,206.6L307.3,207.8L304.1,214.2L302.3,225.1L297.2,229.5L295.3,229.2L296.3,231.0L294.1,233.1L293.9,230.6L288.3,231.0L287.4,233.5L290.8,235.8L285.1,240.4L283.6,236.8L285.9,233.4L281.8,231.4L282.1,226.3L285.5,220.3L286.2,205.6L289.7,198.4L300.7,194.6L311.3,195.7ZM326.2,129.1L331.3,131.4L335.1,131.2L335.0,133.4L329.7,135.9L326.3,143.3L320.9,146.0L318.8,151.0L311.5,152.0L310.7,143.0L318.5,131.8L326.4,130.9L326.2,129.1ZM326.3,143.3L325.9,146.0L328.8,147.9L333.5,147.5L332.2,149.8L336.7,152.6L336.5,155.1L337.9,154.5L336.9,158.5L321.3,155.9L312.4,157.4L308.8,154.1L318.8,151.0L320.9,146.0L326.3,143.3ZM203.8,191.5L197.5,195.6L195.0,201.3L197.1,212.0L190.8,211.8L183.8,202.7L190.4,194.4L189.8,191.0L192.5,190.6L195.8,186.4L208.2,184.3L203.8,191.5ZM332.7,129.8L326.2,129.1L326.4,130.9L318.5,131.8L318.8,127.0L321.4,126.0L324.4,119.0L332.8,112.7L337.3,106.4L336.4,109.0L340.7,113.6L340.6,116.1L337.4,118.1L334.1,127.9L332.7,125.0L330.1,123.6L329.3,126.6L332.7,129.8ZM184.0,200.7L183.8,202.7L190.8,211.8L197.1,212.0L195.5,223.3L192.5,225.5L186.5,221.6L186.0,222.8L177.5,220.2L170.1,216.3L165.1,217.7L156.1,216.9L148.8,202.3L163.1,201.6L180.6,205.9L175.4,204.1L184.0,200.7ZM291.5,197.1L286.2,205.6L286.0,212.3L277.1,209.7L262.6,202.1L268.3,191.3L266.7,187.6L263.8,186.8L270.5,179.2L287.6,174.6L288.5,177.7L286.1,182.0L291.9,185.2L291.5,197.1ZM245.5,240.2L244.1,255.5L240.5,259.1L230.4,260.1L222.1,258.3L225.9,242.9L232.0,234.6L230.8,231.5L235.5,228.8L245.5,240.2ZM177.3,240.0L197.0,247.8L196.8,251.1L193.4,252.6L189.0,260.1L174.7,251.6L172.7,252.1L169.9,248.2L169.1,240.9L174.0,241.6L177.3,240.0ZM249.1,233.0L263.7,248.2L261.6,249.4L257.9,246.4L245.8,249.8L245.5,240.2L235.5,228.8L242.8,222.8L249.1,233.0ZM240.5,259.2L245.2,264.6L247.2,270.6L244.9,272.8L246.2,275.9L238.6,276.2L236.9,273.9L223.4,277.6L222.5,276.0L213.5,281.2L215.8,271.7L217.4,269.6L220.9,269.6L222.7,266.0L217.6,264.7L218.8,261.8L217.4,260.5L221.6,258.3L230.4,260.1L240.5,259.2ZM286.0,212.3L285.5,220.3L282.1,226.3L282.1,231.0L279.4,232.3L277.7,240.8L272.8,242.4L272.3,239.9L267.3,239.8L262.8,242.6L262.4,245.7L249.1,233.0L242.8,222.8L265.4,217.6L270.6,214.2L270.9,206.4L286.0,212.3ZM333.5,147.5L330.0,148.4L325.9,146.0L327.1,140.7L329.7,135.9L338.4,132.5L341.3,136.9L339.9,136.4L338.4,142.8L335.3,143.9L333.5,147.5ZM73.7,317.7L84.5,326.3L87.5,334.8L92.4,339.1L85.7,344.8L76.5,345.1L73.9,347.0L69.9,353.2L69.4,358.7L66.2,360.2L65.4,364.5L58.6,369.5L57.6,372.5L53.3,370.2L53.1,367.8L55.9,343.8L66.3,322.2L71.0,317.6L73.7,317.7Z";

/** Major city dot positions for the footer miniature (subset of full silhouette) */
const FOOTER_CITY_DOTS = [
  { x: 145.7, y: 83.2 },   // Kalibo area
  { x: 286.0, y: 144.4 },  // Roxas City
  { x: 158.8, y: 248.5 },  // Iloilo City
  { x: 41.1, y: 300.9 },   // San Jose de Buenavista
  { x: 229.1, y: 268.5 },  // Pavia/Iloilo corridor
];

/** Miniature, hoverable Panay Island silhouette for the footer */
function FooterIslandSilhouette() {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      title="Panay Island — SANAG Coverage Area"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        cursor: 'default',
        transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1), filter 0.35s ease',
        transform: hovered ? 'translateY(-4px) scale(1.05)' : 'translateY(0) scale(1)',
        filter: hovered
          ? 'drop-shadow(0 0 8px rgba(245,158,11,0.55)) drop-shadow(0 0 18px rgba(245,158,11,0.25))'
          : 'drop-shadow(0 0 3px rgba(245,158,11,0.22)) drop-shadow(0 0 6px rgba(245,158,11,0.10))',
      }}
      aria-label="Panay Island silhouette"
    >
      <svg
        viewBox="0 0 400 400"
        width={72}
        height={72}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        style={{ display: 'block', overflow: 'visible' }}
      >
        <defs>
          <filter id="footer-island-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="footer-city-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fcd34d" stopOpacity="0.75" />
            <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Island landmass fill — dark slate */}
        <path
          d={PANAY_PATH}
          fill="#1e293b"
          fillOpacity={hovered ? 0.92 : 0.78}
          stroke="#f59e0b"
          strokeWidth={hovered ? 1.1 : 0.7}
          strokeOpacity={hovered ? 0.75 : 0.42}
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{ transition: 'fill-opacity 0.3s, stroke-width 0.3s, stroke-opacity 0.3s' }}
        />

        {/* Major city light dots */}
        <g filter="url(#footer-island-glow)">
          {FOOTER_CITY_DOTS.map((dot, i) => (
            <g key={i}>
              {/* Ambient bloom */}
              <circle cx={dot.x} cy={dot.y} r={hovered ? 9 : 6} fill="url(#footer-city-glow)" style={{ transition: 'r 0.3s' }} />
              {/* Core pinpoint */}
              <circle
                cx={dot.x}
                cy={dot.y}
                r={hovered ? 2.4 : 1.6}
                fill="#fde68a"
                fillOpacity={hovered ? 0.95 : 0.70}
                style={{ transition: 'r 0.3s, fill-opacity 0.3s' }}
              />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}

export interface FooterProps {
  onSelectRegion?: (regionKey: string) => void;
  selectedRegionKey?: string;
}

interface ProvinceItem {
  key: string;
  name: string;
  lgus: string;
  description: string;
}

const PROVINCES: ProvinceItem[] = [
  { key: 'aklan', name: 'Aklan Province', lgus: '17 LGUs', description: 'Kalibo, Malay, Boracay corridor' },
  { key: 'antique', name: 'Antique Province', lgus: '18 LGUs', description: 'San Jose, Culasi, Western seaboard' },
  { key: 'capiz', name: 'Capiz Province', lgus: '17 LGUs', description: 'Roxas City, Panay heartland' },
  { key: 'iloilo', name: 'Iloilo Province', lgus: '43 LGUs', description: 'Iloilo City, Southern & Central grid' },
];

export default function Footer({ onSelectRegion, selectedRegionKey }: FooterProps) {
  const handleProvinceClick = (e: React.MouseEvent, regionKey: string) => {
    e.preventDefault();

    // Trigger region change callback if passed
    if (onSelectRegion) {
      onSelectRegion(regionKey);
    }

    // Broadcast custom event so PanayMap can flyTo and render region boundaries
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('sanag:focus-province', {
          detail: { provinceKey: regionKey, regionKey },
        })
      );
      window.dispatchEvent(
        new CustomEvent('sanag:select-region', {
          detail: { regionKey },
        })
      );
    }

    // Smoothly scroll to the interactive map section
    const mapElement = document.getElementById('map');
    if (mapElement) {
      mapElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.location.hash = '#map';
    }
  };

  return (
    <footer className="relative border-t border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-ink-950 transition-colors">
      <div className="absolute inset-0 grid-bg opacity-20" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-ocean-500 to-emerald-500 shadow-md shadow-ocean-500/20">
                <Satellite className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="text-base font-extrabold text-slate-900 dark:text-white">SANAG</span>
                <p className="text-[10px] text-slate-500 dark:text-ink-400">Satellite Analytics for Nightlight & Assessment Grid</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-ink-400 leading-relaxed max-w-sm">
              A free, open dashboard for exploring municipality boundaries and recovery indicators
              across Panay Island. Built for local leaders, students, and residents.
            </p>
          </div>

          {/* Data sources */}
          <div>
            <h4 className="text-xs font-semibold text-slate-800 dark:text-ink-300 uppercase tracking-wider mb-4">Data Sources</h4>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-ink-400">
              <li>
                <a
                  href="https://github.com/jamesphillipdeguzman/sanag/blob/main/frontend/public/panay_municipalities.geojson"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-1.5 hover:text-ocean-600 dark:hover:text-ocean-400 transition-colors"
                >
                  <span>GeoJSON Municipal Boundaries</span>
                  <ExternalLink className="h-3 w-3 text-slate-400 group-hover:text-ocean-600 dark:text-ink-500 dark:group-hover:text-ocean-400 transition-colors" />
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/jamesphillipdeguzman/sanag/blob/main/frontend/src/data/mockData.ts"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-1.5 hover:text-ocean-600 dark:hover:text-ocean-400 transition-colors"
                >
                  <span>Local demo recovery metrics</span>
                  <ExternalLink className="h-3 w-3 text-slate-400 group-hover:text-ocean-600 dark:text-ink-500 dark:group-hover:text-ocean-400 transition-colors" />
                </a>
              </li>
              <li>
                <a
                  href="https://developers.google.com/earth-engine/datasets/catalog/NASA_VIIRS_002_VNP46A2"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-1.5 hover:text-ocean-600 dark:hover:text-ocean-400 transition-colors"
                >
                  <span>NASA VIIRS Daily Radiance (VNP46A2)</span>
                  <ExternalLink className="h-3 w-3 text-slate-400 group-hover:text-ocean-600 dark:text-ink-500 dark:group-hover:text-ocean-400 transition-colors" />
                </a>
              </li>
              <li>
                <a
                  href="https://developers.google.com/earth-engine/datasets/catalog/NOAA_VIIRS_DNB_MONTHLY_V1_VCMSLCFG"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-1.5 hover:text-ocean-600 dark:hover:text-ocean-400 transition-colors"
                >
                  <span>NOAA Monthly Baselines (VCMSLCFG)</span>
                  <ExternalLink className="h-3 w-3 text-slate-400 group-hover:text-ocean-600 dark:text-ink-500 dark:group-hover:text-ocean-400 transition-colors" />
                </a>
              </li>
              <li>
                <a
                  href="https://sanag.onrender.com/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-1.5 hover:text-ocean-600 dark:hover:text-ocean-400 transition-colors font-medium text-ocean-600 dark:text-ocean-400"
                >
                  <span>FastAPI Interactive API Docs</span>
                  <ExternalLink className="h-3 w-3 text-ocean-500 dark:text-ocean-400 group-hover:text-ocean-600 transition-colors" />
                </a>
              </li>
            </ul>
          </div>

          {/* Coverage Area with Interactive Map Focus Links */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-slate-800 dark:text-ink-300 uppercase tracking-wider">
                Coverage Area
              </h4>
              <button
                type="button"
                onClick={(e) => handleProvinceClick(e, 'panay')}
                className="text-[11px] font-medium text-ocean-600 dark:text-ocean-400 hover:underline inline-flex items-center gap-1 cursor-pointer transition-colors"
                title="View full Panay Island overview on interactive map"
              >
                <Compass className="h-3 w-3" />
                <span>All Panay ({PROVINCES.reduce((acc, p) => acc + (parseInt(p.lgus, 10) || 0), 0) || 95} LGUs)</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-ink-400 mb-3">
              Click a province below to center the interactive map and focus its municipal boundaries:
            </p>

            <ul className="space-y-2">
              {PROVINCES.map((prov) => {
                const isSelected = selectedRegionKey === prov.key;
                return (
                  <li key={prov.key}>
                    <a
                      href="#map"
                      onClick={(e) => handleProvinceClick(e, prov.key)}
                      className={`group flex items-center justify-between p-2 rounded-xl border transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? 'bg-ocean-50/90 dark:bg-ocean-500/15 border-ocean-400/60 dark:border-ocean-500/40 text-ocean-700 dark:text-ocean-200 shadow-sm'
                          : 'bg-white/60 dark:bg-white/5 border-slate-200/80 dark:border-white/10 hover:border-ocean-300 dark:hover:border-ocean-500/30 hover:bg-ocean-50/50 dark:hover:bg-ocean-500/10 text-slate-700 dark:text-ink-300'
                      }`}
                      title={`Focus map on ${prov.name} (${prov.lgus})`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
                            isSelected
                              ? 'bg-ocean-500 text-white'
                              : 'bg-slate-100 dark:bg-white/10 text-ocean-600 dark:text-ocean-400 group-hover:bg-ocean-500 group-hover:text-white'
                          }`}
                        >
                          <MapPin className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0">
                          <span className="text-xs font-semibold block truncate group-hover:text-ocean-600 dark:group-hover:text-ocean-300 transition-colors">
                            {prov.name}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-ink-500 block truncate">
                            {prov.description}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-ink-400 group-hover:text-ocean-600 dark:group-hover:text-ocean-300 transition-colors">
                          {prov.lgus}
                        </span>
                        <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-ocean-600 dark:text-ink-500 dark:group-hover:text-ocean-300 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </div>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-200 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Miniature interactive island silhouette */}
            <FooterIslandSilhouette />
            <div className="flex flex-col gap-1">
              <p className="text-xs text-slate-500 dark:text-ink-500">
                CSE 499 Project · Panay Island, Philippines
              </p>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded bg-slate-200/50 dark:bg-slate-800/50 border border-slate-300/50 dark:border-slate-700/40 self-start">
                v{APP_VERSION}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-ink-500">
            <a
              href="https://sanag.onrender.com/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-ocean-600 dark:hover:text-ocean-400 font-medium transition-colors"
            >
              <span>API Docs</span>
              <ExternalLink className="h-3 w-3" />
            </a>
            <span>·</span>
            <span>Built for Panay communities</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

