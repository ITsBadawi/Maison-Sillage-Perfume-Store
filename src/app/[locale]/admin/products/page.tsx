import {redirect} from 'next/navigation';
import {getTranslations} from 'next-intl/server';
import {getCurrentStaffRoles, getCurrentUser} from '@/lib/auth/current-user';
import {hasAnyRole} from '@/features/admin/schemas';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {AdminJsonForm} from '@/components/admin/admin-json-form';
import {ProductImageUpload} from '@/components/admin/product-image-upload';

type Variant = {id:string;sku:string;sizeMl:number;priceMinor:string;compareAtMinor:string|null;stockAvailable:number;lowStockThreshold:number;active:boolean};
type Note = {layer:'top'|'heart'|'base';slug:string;nameAr:string;nameEn:string};
type Product = {id:string;slug:string;brand:string;nameAr:string;nameEn:string;shortDescriptionAr:string;shortDescriptionEn:string;descriptionAr:string;descriptionEn:string;status:string;version:number;categoryId:string|null;gender:string;family:string;seasons:string[];occasions:string[];concentration:string;longevityHoursMin:number|null;longevityHoursMax:number|null;projection:number|null;featured:boolean;recommendationEnabled:boolean;priority:number;imagePath:string;imageAltAr:string;imageAltEn:string;imageUrl?:string;notes:Note[];attributes:Record<string,number>;variants:Variant[]};
type Category = {id:string;slug:string;nameAr:string;nameEn:string;active:boolean};
const dimensions=['woody','floral','fresh','sweet','warm','smoky','bold','calm','classic','modern','day','night'] as const;

function majorIqd(minor:string|null) { if (!minor) return ''; const text=minor.padStart(4,'0'); return `${text.slice(0,-3)}.${text.slice(-3)}`.replace(/\.0+$/,'').replace(/(\.\d*?)0+$/,'$1'); }
function ProductFields({product,categories,t}: {product?:Product;categories:Category[];t:(key:string)=>string}) {
  const notes=(product?.notes??[]).map((n)=>`${n.layer}|${n.slug}|${n.nameAr}|${n.nameEn}`).join('\n');
  const attrs=dimensions.map((key)=>`${key}=${product?.attributes?.[key] ?? 0}`).join('\n');
  return <>
    {product&&<><input type="hidden" name="productId" value={product.id}/><input type="hidden" name="expectedVersion" value={product.version}/></>}
    <label>{t('slug')}<input name="slug" defaultValue={product?.slug??''} required pattern="[a-z0-9]+(-[a-z0-9]+)*"/></label>
    <label>{t('brand')}<input name="brand" defaultValue={product?.brand??''} required/></label>
    <label>{t('nameAr')}<input name="nameAr" defaultValue={product?.nameAr??''} required/></label>
    <label>{t('nameEn')}<input name="nameEn" defaultValue={product?.nameEn??''} required/></label>
    <label>{t('shortAr')}<textarea name="shortDescriptionAr" defaultValue={product?.shortDescriptionAr??''}/></label>
    <label>{t('shortEn')}<textarea name="shortDescriptionEn" defaultValue={product?.shortDescriptionEn??''}/></label>
    <label>{t('descriptionAr')}<textarea name="descriptionAr" defaultValue={product?.descriptionAr??''}/></label>
    <label>{t('descriptionEn')}<textarea name="descriptionEn" defaultValue={product?.descriptionEn??''}/></label>
    <label>{t('category')}<select name="categoryId" defaultValue={product?.categoryId??''}><option value="">{t('noCategory')}</option>{categories.map((c)=><option value={c.id} key={c.id}>{c.nameAr} / {c.nameEn}</option>)}</select></label>
    <label>{t('gender')}<select name="gender" defaultValue={product?.gender??'unisex'}>{(['women','men','unisex'] as const).map((v)=><option key={v} value={v}>{t(`genders.${v}`)}</option>)}</select></label>
    <label>{t('family')}<input name="family" defaultValue={product?.family??''}/></label>
    <label>{t('seasons')}<input name="seasons" defaultValue={(product?.seasons??[]).join(',')}/><span className="admin-help">{t('seasonValues')}</span></label>
    <label>{t('occasions')}<input name="occasions" defaultValue={(product?.occasions??[]).join(',')}/><span className="admin-help">{t('occasionValues')}</span></label>
    <label>{t('concentration')}<input name="concentration" defaultValue={product?.concentration??''}/></label>
    <label>{t('longevityMin')}<input name="longevityHoursMin" type="number" min="0" max="999" step="0.5" defaultValue={product?.longevityHoursMin??''}/></label>
    <label>{t('longevityMax')}<input name="longevityHoursMax" type="number" min="0" max="999" step="0.5" defaultValue={product?.longevityHoursMax??''}/></label>
    <label>{t('projection')}<select name="projection" defaultValue={product?.projection??''}><option value="">—</option>{[1,2,3,4,5].map((n)=><option key={n} value={n}>{n}</option>)}</select></label>
    <label>{t('status')}<select name="status" defaultValue={product?.status??'draft'}><option value="draft">{t('statuses.draft')}</option><option value="published">{t('statuses.published')}</option><option value="archived">{t('statuses.archived')}</option></select></label>
    <label>{t('priority')}<input name="priority" type="number" min="-1000" max="1000" defaultValue={product?.priority??0}/></label>
    <label className="admin-check"><input name="featured" type="checkbox" defaultChecked={product?.featured??false}/>{t('featured')}</label>
    <label className="admin-check"><input name="recommendationEnabled" type="checkbox" defaultChecked={product?.recommendationEnabled??false}/>{t('recommendationEnabled')}</label>
    <ProductImageUpload name="imagePath" path={product?.imagePath??''} url={product?.imageUrl??''} label={t('imagePath')} uploadLabel={t('uploadImage')} help={t('imageUploadHelp')} acceptLabel={t('imageTypes')} workingLabel={t('imageUploading')} errorLabel={t('imageUploadError')}/>
    <label>{t('imageAltAr')}<input name="imageAltAr" defaultValue={product?.imageAltAr??''}/></label>
    <label>{t('imageAltEn')}<input name="imageAltEn" defaultValue={product?.imageAltEn??''}/></label>
    <label>{t('notes')}<textarea name="notes" rows={5} defaultValue={notes} placeholder="top|bergamot|برغموت|Bergamot"/><span className="admin-help">{t('notesHelp')}</span></label>
    <label>{t('attributes')}<textarea name="attributes" rows={8} defaultValue={attrs}/><span className="admin-help">{t('attributesHelp')}</span></label>
  </>;
}

function VariantEditor({product,variant,t}: {product:Product;variant?:Variant;t:(key:string)=>string}) {
  return <AdminJsonForm url={`/api/admin/products/${product.id}/variants`} submitLabel={variant?t('saveVariant'):t('addVariant')}>
    <input type="hidden" name="expectedProductVersion" value={product.version}/>{variant&&<input type="hidden" name="variantId" value={variant.id}/>}
    <label>{t('sku')}<input name="sku" defaultValue={variant?.sku??''} required/></label>
    <label>{t('sizeMl')}<input name="sizeMl" type="number" min="0.01" step="0.01" defaultValue={variant?.sizeMl??''} required/></label>
    <label>{t('priceIqd')}<input name="priceIqd" inputMode="decimal" pattern="[0-9]+(\\.[0-9]{1,3})?" defaultValue={majorIqd(variant?.priceMinor??null)} required/><span className="admin-help">{t('iqdPrecision')}</span></label>
    <label>{t('compareIqd')}<input name="compareAtIqd" inputMode="decimal" defaultValue={majorIqd(variant?.compareAtMinor??null)}/></label>
    <label>{t('lowStock')}<input name="lowStockThreshold" type="number" min="0" defaultValue={variant?.lowStockThreshold??2}/></label>
    <label className="admin-check"><input name="active" type="checkbox" defaultChecked={variant?.active??true}/>{t('active')}</label>
  </AdminJsonForm>;
}

export default async function AdminProducts({params}: {params:Promise<{locale:string}>}) {
  const {locale}=await params;
  const t=await getTranslations('adminCatalog');
  const [user,roles,supabase]=await Promise.all([getCurrentUser(),getCurrentStaffRoles(),createSupabaseServerClient()]);
  if (!user) redirect(`/${locale}/auth/login`);
  if (!hasAnyRole(roles,['manager','inventory_manager'])) redirect(`/${locale}/admin`);
  const [{data,error},{data:categoryData}]=supabase ? await Promise.all([supabase.rpc('admin_list_products'),supabase.rpc('admin_list_categories')]) : [{data:null,error:{message:'unconfigured'}},{data:null}];
  const products=((data??[]) as Product[]).map((product)=>({...product,imageUrl:product.imagePath.startsWith('assets/')?`/${product.imagePath}`:product.imagePath?supabase!.storage.from('catalog-images').getPublicUrl(product.imagePath).data.publicUrl:''})); const categories=(categoryData??[]) as Category[];
  const tr=(key:string)=>t(key as never);
  return <main className="admin-page" dir={locale==='ar'?'rtl':'ltr'}><a href={`/${locale}/admin`}>← {t('back')}</a><p className="eyebrow">{t('eyebrow')}</p><h1>{t('title')}</h1>
    <details className="admin-panel"><summary>{t('createProduct')}</summary><AdminJsonForm url="/api/admin/products" submitLabel={t('createDraft')}><ProductFields categories={categories} t={tr}/></AdminJsonForm></details>
    <details className="admin-panel"><summary>{t('categories')}</summary><p>{t('categoryHelp')}</p><AdminJsonForm url="/api/admin/categories" submitLabel={t('saveCategory')}><label>{t('slug')}<input name="slug" required/></label><label>{t('nameAr')}<input name="nameAr" required/></label><label>{t('nameEn')}<input name="nameEn" required/></label><label className="admin-check"><input name="active" type="checkbox" defaultChecked/>{t('active')}</label></AdminJsonForm>
      {categories.map((category)=><AdminJsonForm key={category.id} url="/api/admin/categories" submitLabel={t('saveCategory')}><input type="hidden" name="id" value={category.id}/><label>{t('slug')}<input name="slug" defaultValue={category.slug} required/></label><label>{t('nameAr')}<input name="nameAr" defaultValue={category.nameAr} required/></label><label>{t('nameEn')}<input name="nameEn" defaultValue={category.nameEn} required/></label><label className="admin-check"><input name="active" type="checkbox" defaultChecked={category.active}/>{t('active')}</label></AdminJsonForm>)}
    </details>
    {error?<p className="admin-error">{t('loadError')}</p>:products.length?<div className="admin-product-list">{products.map((product)=><section className="admin-panel" key={product.id}>
      <details><summary><strong>{locale==='ar'?product.nameAr:product.nameEn}</strong> <span>{t(`statuses.${product.status}`)}</span> · {product.variants.length} {t('variantsCount')}</summary><AdminJsonForm url="/api/admin/products" submitLabel={t('saveProduct')}><ProductFields product={product} categories={categories} t={tr}/></AdminJsonForm></details>
      <h2>{t('variants')}</h2>{product.variants.map((variant)=><div className="admin-variant" key={variant.id}><div><strong>{variant.sku}</strong> · {variant.sizeMl} ml · {(Number(variant.priceMinor)/1000).toLocaleString(locale)} IQD · {t('stock')}: {variant.stockAvailable}{variant.stockAvailable<=variant.lowStockThreshold?` · ${t('low')}`:''}</div><details><summary>{t('editVariant')}</summary><VariantEditor product={product} variant={variant} t={tr}/></details><AdminJsonForm url="/api/admin/inventory/adjustments" submitLabel={t('adjustStock')} className="admin-form admin-stock-form"><input type="hidden" name="variantId" value={variant.id}/><input type="hidden" name="eventKey" value={`admin:${variant.id}:${crypto.randomUUID()}`}/><label>{t('changeStock')}<input name="delta" type="number" step="1" required/></label><label>{t('reason')}<input name="reason" minLength={3} maxLength={250} required/></label></AdminJsonForm></div>)}
      <details><summary>{t('addVariant')}</summary><VariantEditor product={product} t={tr}/></details>
    </section>)}</div>:<p className="admin-empty">{t('empty')}</p>}
  </main>;
}
