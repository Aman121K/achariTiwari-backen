import 'dotenv/config';
import connectDB from '../config/database';
import User from '../models/User';
import Category from '../models/Category';
import Product from '../models/Product';
import BlogPost from '../models/BlogPost';
import Banner from '../models/Banner';
import StoreSettings from '../models/StoreSettings';

const catalog = [
  ['premium-red-chili-aachar','Premium Red Chili Aachar',299,'/products/red-chili-aachar.jpg'],['traditional-mango-aachar','Traditional Mango Aachar',349,'/products/mango-aachar.jpg'],
  ['fresh-lime-pickle','Fresh Lime Pickle',249,'/products/lime-pickle.jpg'],['garlic-pickle-delight','Garlic Pickle Delight',279,'/products/garlic-pickle.jpg'],
  ['mixed-vegetable-aachar','Mixed Vegetable Aachar',399,'/products/mixed-aachar-collection.jpg'],['spicy-ginger-pickle','Spicy Ginger Pickle',269,'/products/red-chili-aachar.jpg'],
  ['amla-gooseberry-aachar','Amla Gooseberry Aachar',329,'/products/garlic-pickle.jpg'],['kaddu-ka-aachar','Kaddu Ka Aachar',249,'/products/mixed-aachar-collection.jpg'],
  ['nimbu-mirch-ka-aachar','Nimbu Mirch Ka Aachar',199,'/products/lime-pickle.jpg'],['khatta-meetha-aam','Khatta Meetha Aam Ka Aachar',369,'/products/mango-aachar.jpg'],
  ['lal-mirch-lahsun','Lal Mirch Aur Lahsun',319,'/products/red-chili-aachar.jpg'],['gobhi-gajar-aachar','Gobhi Gajar Ka Aachar',289,'/products/mixed-aachar-collection.jpg'],
  ['pyaz-ka-aachar','Pyaz Ka Aachar',229,'/products/garlic-pickle.jpg'],['aloo-bukhara-aachar','Aloo Bukhara Aachar',399,'/products/mango-aachar.jpg'],
  ['til-gud-aam-aachar','Til Gud Aam Aachar',449,'/products/mango-aachar.jpg'],['bharwan-karela-aachar','Bharwan Karela Aachar',349,'/products/mixed-aachar-collection.jpg'],
  ['instant-tadka-aachar','Instant Tadka Aachar',189,'/products/red-chili-aachar.jpg'],
];

async function seed(){
  await connectDB();
  const adminEmail=(process.env.ADMIN_EMAIL||'admin@acharitiwari.com').toLowerCase();
  if(!await User.findOne({email:adminEmail})) await User.create({name:'Store Admin',email:adminEmail,phone:'9999999999',password:process.env.ADMIN_PASSWORD||'ChangeMe123!',role:'admin'});
  const category=await Category.findOneAndUpdate({slug:'all-pickles'},{$set:{name:'All Pickles',description:'Traditional Indian aachar',isActive:true}}, {new:true,upsert:true});
  for(const [slug,title,price,image] of catalog) await Product.findOneAndUpdate({slug},{$set:{title,name:title,slug,category:category._id,shortDescription:`Traditional ${title} made with carefully selected ingredients.`,description:`Enjoy authentic ${title}, prepared in small batches with balanced spices and traditional methods.`,images:[image],ingredients:['Seasonal produce','Mustard oil','Traditional spices','Salt'],collections:['All Pickles'],options:[],variants:[{label:'Standard jar',size:'Standard jar',optionValues:[],sku:`AT-${String(slug).toUpperCase().slice(0,18)}`,price,inventory:50,lowStockThreshold:5,isActive:true}],tags:['aachar','traditional','homemade'],salesChannels:['online_store','cod_checkout'],marketing:{badge:'Traditional',upsellProductSlugs:[],crossSellProductSlugs:[]},shipping:{isPhysicalProduct:true,shelfLife:'12 months'},seoTitle:`Buy ${title} Online | Achari Tiwari`,seoDescription:`Order authentic ${title} online from Achari Tiwari.`,seoKeywords:[title,'aachar online'],status:'active',featured:Number(price)>=299}}, {upsert:true,new:true,setDefaultsOnInsert:true});
  await Banner.findOneAndUpdate({title:'Taste of Tradition'},{$set:{description:'Ghar ka swaad, har bite mein pyaar',image:'/brand/achari-tiwari-logo.png',mobileImage:'/brand/achari-tiwari-logo.png',link:'/products',linkType:'external',position:1,displayLocation:'home',isActive:true}}, {upsert:true,new:true});
  await BlogPost.findOneAndUpdate({slug:'the-art-of-traditional-aachar'},{$set:{title:'The Art of Traditional Indian Aachar',excerpt:'How seasonal produce, aromatic spices and patient preparation create the flavours we love.',content:'Traditional aachar begins with carefully selected seasonal produce. It is cleaned, prepared and combined with balanced spices, salt and oil. Time allows the flavours to mature while careful handling protects freshness. At Achari Tiwari, every recipe celebrates this familiar Indian pantry tradition and shares practical storage guidance for every jar.',category:'brand-stories',author:'Achari Tiwari Kitchen',tags:['aachar','tradition'],status:'published',featured:true,publishedAt:new Date()}}, {upsert:true,new:true});
  await StoreSettings.findOneAndUpdate({key:'primary'},{$setOnInsert:{key:'primary'}},{upsert:true,new:true,setDefaultsOnInsert:true});
  console.log(`Seed complete. Admin: ${adminEmail}. Change the initial password immediately.`);
  process.exit(0);
}
seed().catch(error=>{console.error(error);process.exit(1)});
