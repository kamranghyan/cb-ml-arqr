import { API_BASE } from "./api-config";


export async function fetchCategories(
 restaurantId:string
){

 const res = await fetch(
 `${API_BASE}/restaurants/${restaurantId}/categories`
 );

 if(!res.ok){
   throw new Error("Failed loading categories");
 }

 return res.json();
}