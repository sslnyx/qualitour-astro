/** The filterable catalogue needs card fields, not every tour's full itinerary. */
export function toTourBrowseCard(tour){
 const keys=['price','tour-price-text','tour-price-discount-text','tourmaster-tour-discount','tourmaster-tour-currency','duration_text','ribbon'];
 return {id:tour.id,slug:tour.slug,date:tour.date,status:tour.status,title:tour.title,excerpt:tour.excerpt,featured_media:tour.featured_media,featured_image_url:tour.featured_image_url,optimizedImageUrl:tour.optimizedImageUrl,content:{rendered:''},tour_terms:tour.tour_terms,tour_meta:Object.fromEntries(keys.filter(key=>Object.hasOwn(tour.tour_meta||{},key)).map(key=>[key,tour.tour_meta[key]]))};
}
