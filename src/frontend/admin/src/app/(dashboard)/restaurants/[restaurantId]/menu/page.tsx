'use client';

import { useParams } from 'next/navigation';

import { useState, useEffect, useCallback } from 'react';
import {
  Search, RefreshCw, Bell, Plus, Edit2, Trash2,
  X, CloudUpload, Loader2, AlertCircle, CheckCircle,
} from 'lucide-react';
import { formatPrice } from '@/lib/data';
import { Toggle, StatusChip } from '@/components/ui';
import {
  fetchMenuItems,
  fetchMenuItem,
  updateMenuItem,
  fetchCategories,
  fetchMenuItemAddons,
  normaliseItem,
  type ApiMenuItem,
  type ApiAddon,
  deleteMenuItem,
  createAddon,
  updateAddon,
} from '@/lib/menu-api';
import { TENANT_ID } from '@/lib/api-config';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import Image from 'next/image';
import { getTheme } from '@/lib/theme';

// ── Brand Color ──
const BRAND = '#ff5723';

// ── Theme-based colors (matching checkout page) ──
const getColors = (isDark: boolean) => ({
  bg: isDark ? '#111111' : '#FFF8F1',
  card: isDark ? '#1C1C1C' : '#FFFFFF',
  card2: isDark ? '#242424' : '#F9FAFB',
  border: isDark ? 'rgba(255,255,255,0.08)' : '#F0E8E0',
  text: isDark ? '#F5F0E8' : '#1A1A1A',
  bell: isDark ? "white" : "white",
  muted: isDark ? '#9CA3AF' : '#6B6B6B',
  subtle: isDark ? '#6B7280' : '#9CA3AF',
  inputBg: isDark ? '#1C1C1C' : '#FFFFFF',
  inputBorder: isDark ? 'rgba(255,255,255,0.08)' : '#F0E8E0',
  inputText: isDark ? '#F5F0E8' : '#1A1A1A',
  brand: BRAND,
  brandBg: isDark ? 'rgba(255,87,35,0.12)' : 'rgba(255,87,35,0.12)',
  hoverBg: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6',
  focusRing: isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)',
  green: isDark ? '#4ade80' : '#0F9D58',
  danger: isDark ? '#ff8a5c' : '#E1251B',
  warning: isDark ? '#fb923c' : '#d97706',
  placeholder: isDark ? '#6B7280' : '#888888',
  modalOverlay: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)',
  imageBg: isDark ? 'rgb(255, 87, 35)' : 'rgb(255, 87, 35)',
  imageBorder: isDark ? 'rgb(255, 87, 35)' : 'rgb(240, 232, 224)',
  statusBg: isDark ? 'rgba(34,197,94,0.12)' : '#F0FFF4',
  statusBorder: isDark ? 'rgba(34,197,94,0.3)' : '#BBF7D0',
  statusText: isDark ? '#4ade80' : '#16a34a',
  inactiveBg: isDark ? 'rgba(156,163,175,0.12)' : '#F9FAFB',
  inactiveBorder: isDark ? 'rgba(156,163,175,0.2)' : '#F0E8E0',
  inactiveText: isDark ? '#9CA3AF' : '#687780',
  activeDot: isDark ? '#4ade80' : '#22c55e',
  inactiveDot: isDark ? '#6B7280' : '#D1D5DB',
  glbBg: isDark ? 'rgba(124,58,237,0.12)' : '#FAF5FF',
  glbBorder: isDark ? 'rgba(124,58,237,0.3)' : '#DDD6FE',
  glbText: isDark ? '#a78bfa' : '#7c3aed',
  shadow: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(137,28,28,0.15)',
});

type ModalState = { open: boolean; item?: ApiMenuItem };
type LoadState = 'idle' | 'loading' | 'success' | 'error';
type GlbStatus = 'idle' | 'uploading' | 'approved' | 'error';

// ✅ Updated createMenuItemWithFiles with slides support
async function createMenuItemWithFiles(
  restaurantId: string,
  payload: {
    name: string;
    description: string;
    price: number;
    categoryId: string;
    isActive: boolean;
    allergens?: string[];
    prepTime?: string;
    calories?: number;
    sizes?: { name: string; price: number }[];
    slides?: { position: number; imageKey?: string }[];
  },
  imageFile?: File | null,
  glbFile?: File | null,
  imageFiles: File[] = [], // ✅ Multiple images for slides
): Promise<any> {
  const fd = new FormData();

  fd.append('name', payload.name);
  fd.append('description', payload.description);
  fd.append(
    'priceMinorUnits',
    String(Math.round(payload.price * 100))
  );
  fd.append('categoryId', payload.categoryId);
  fd.append('isActive', String(payload.isActive));
  fd.append('restaurantId', restaurantId);

  if (payload.allergens?.length) {
    fd.append('allergens', payload.allergens.join(','));
  }

  if (payload.prepTime) {
    fd.append('prepTime', payload.prepTime);
  }

  if (payload.calories !== undefined) {
    fd.append('calories', String(payload.calories));
  }

  // ✅ Sizes as JSON string
  if (payload.sizes?.length) {
    const sizesPayload = payload.sizes.map(size => ({
      name: size.name,
      priceMinorUnits: Math.round(size.price * 100),
    }));
    fd.append('sizes', JSON.stringify(sizesPayload));
  }

  // ✅ Slides as JSON string (positions will be set by backend)
  if (payload.slides?.length) {
    const slidesPayload = payload.slides.map((slide, index) => ({
      position: slide.position || index + 1,
      imageKey: slide.imageKey || '',
    }));
    fd.append('slides', JSON.stringify(slidesPayload));
    console.log('📤 Slides payload:', JSON.stringify(slidesPayload));
  }

  // Main image
  if (imageFile) {
    fd.append('file', imageFile);
  }

  // AR model
  if (glbFile) {
    fd.append('arFile', glbFile);
  }

  // ✅ Multiple images for slides - Pass the full file objects
  imageFiles.forEach(file => {
    fd.append('images', file);
    console.log('📎 Slide image attached:', file.name, file.size);
  });

  const { getValidIdToken } = await import('@/lib/cognito');
  const token = await getValidIdToken();

  if (!token) {
    throw new Error('Authentication token missing.');
  }

  const headers: Record<string, string> = {
    Authorization: token,
    'x-tenant-id': TENANT_ID,
  };

  const res = await fetch(
    `/api/menu/restaurants/${restaurantId}/items`,
    {
      method: 'POST',
      headers,
      body: fd,
    }
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => res.statusText);
    throw new Error(
      `Create failed (${res.status}): ${txt}`
    );
  }

  return res.json();
}

function FieldLabel({ children, extra }: { children: React.ReactNode; extra?: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const theme = getTheme();
    setIsDark(theme === 'dark');
  }, []);

  const colors = getColors(isDark);

  return (
    <label style={{
      display: 'block',
      fontSize: 11,
      color: colors.subtle,
      fontWeight: 700,
      letterSpacing: 1.5,
      textTransform: 'uppercase' as const,
      marginBottom: 6,
      fontFamily: "'Poppins', sans-serif",
    }}>
      {children}{extra && <span style={{ marginLeft: 8, textTransform: 'none', fontWeight: 400, letterSpacing: 0, fontFamily: "'Poppins', sans-serif" }}>{extra}</span>}
    </label>
  );
}

export default function BranchMenuPage() {
  const restaurantId = String(useParams().restaurantId ?? '');
  const [isDark, setIsDark] = useState(false);
  const [items, setItems] = useState<ApiMenuItem[]>([]);
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [modal, setModal] = useState<ModalState>({ open: false });
  const [isActive, setIsActive] = useState(true);
  const [isChef, setIsChef] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveErr, setSaveErr] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState<string | null>(null);
  const [glbFile, setGlbFile] = useState<File | null>(null);
  const [editingAddon, setEditingAddon] = useState<ApiAddon | null>(null);
  const [addonEditName, setAddonEditName] = useState('');
  const [addonEditPrice, setAddonEditPrice] = useState('');
  const [addonEditDescription, setAddonEditDescription] = useState('');
  const [glbName, setGlbName] = useState<string | null>(null);
  const [glbStatus, setGlbStatus] = useState<GlbStatus>('idle');
  const [glbError, setGlbError] = useState('');
  const [addons, setAddons] = useState<ApiAddon[]>([]);
  const [addonInput, setAddonInput] = useState('');
  const [addonPrice, setAddonPrice] = useState('');
  const [addonDescription, setAddonDescription] = useState('');
  const [itemImages, setItemImages] = useState<File[]>([]);
  const [itemImagePreviews, setItemImagePreviews] = useState<string[]>([]);
  const [form, setForm] = useState({ name: '', description: '', price: '', category: '', prepTime: '', calories: '' });
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    item?: ApiMenuItem;
  }>({ open: false });
  const [sizes, setSizes] = useState<{ name: string; price: string }[]>([]);
  // ✅ Slides state for multiple images
  const [slides, setSlides] = useState<{ file: File | null; preview: string | null }[]>([]);

  // ── Theme listener ──
  useEffect(() => {
    const updateTheme = () => {
      const theme = getTheme();
      setIsDark(theme === 'dark');
    };

    updateTheme();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'admin_theme') updateTheme();
    };
    window.addEventListener('storage', handleStorage);

    const handleThemeToggle = () => updateTheme();
    window.addEventListener('themeChange', handleThemeToggle);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('themeChange', handleThemeToggle);
    };
  }, []);
  const updateAddonHandler = async () => {
    if (!editingAddon) return;

    const name = addonEditName.trim();
    if (!name) {
      setSaveErr('Please enter an add-on name.');
      return;
    }

    const price = Number(addonEditPrice);
    if (!addonEditPrice || Number.isNaN(price) || price < 0) {
      setSaveErr('Please enter a valid add-on price.');
      return;
    }

    setSaving(true);
    setSaveErr('');
    setSaveMsg('');

    try {
      const updated = await updateAddon(
        restaurantId,
        modal.item!.id,
        editingAddon.addOnId,
        {
          name: name,
          description: addonEditDescription.trim(),
          priceMinorUnits: Math.round(price * 100),
          isActive: true,
          sortOrder: 0,
        }
      );

      // Update local state
      setAddons(prev => prev.map(a =>
        a.addOnId === editingAddon.addOnId ? updated : a
      ));

      setEditingAddon(null);
      setAddonEditName('');
      setAddonEditPrice('');
      setAddonEditDescription('');
      setSaveMsg('Add-on updated! ✓');

    } catch (err: any) {
      setSaveErr(err?.message || 'Failed to update add-on.');
    } finally {
      setSaving(false);
    }
  };

  const colors = getColors(isDark);

  const removeSize = (index: number) => {
    setSizes(prev => prev.filter((_, i) => i !== index));
  };

  const loadItems = useCallback(async () => {
    setLoadState("loading");
    setLoadError('');

    try {
      const raw = await fetchMenuItems(restaurantId);
      const categoriesResponse = await fetchCategories(restaurantId);
      const catList = categoriesResponse.map((cat: any) => ({
        id: cat.id ?? cat.categoryId,
        name: cat.name ?? cat.categoryName
      }));

      setCats(catList);

      const categoryMap = new Map(
        catList.map(cat => [
          cat.id,
          cat.name
        ])
      );

      const updatedItems = raw.map((item: any) => {
        const categoryId =
          item.categoryId ??
          item.category?.id ??
          '';

        const categoryName =
          categoryMap.get(categoryId) ??
          item.categoryName ??
          item.category?.name ??
          (typeof item.category === 'string' ? item.category : '') ??
          'Unknown';

        return normaliseItem({
          ...item,
          categoryId,
          categoryName,
        });
      });

      setItems(updatedItems);
      setLoadState("success");
    } catch (err: any) {
      console.error('Full error:', err);
      setLoadError(err?.message ?? 'Failed to load menu items.');
      setLoadState('error');
    }
  }, [restaurantId]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const filtered = items.filter(item => {
    if (item.status === 'inactive') return false;
    const matchCategory =
      category === 'all' ||
      item.categoryId === category;
    const matchSearch =
      item.name
        .toLowerCase()
        .includes(search.toLowerCase());
    return matchCategory && matchSearch;
  });

  const activeItems = items.filter(i => i.status === 'active');

  const addAddon = () => {
    const name = addonInput.trim();

    if (!name) {
      setSaveErr('Please enter an add-on name.');
      return;
    }

    const price = Number(addonPrice);

    if (!addonPrice || Number.isNaN(price) || price < 0) {
      setSaveErr('Please enter a valid add-on price.');
      return;
    }

    const exists = addons.some(
      addon =>
        addon.name.trim().toLowerCase() === name.toLowerCase()
    );

    if (exists) {
      setSaveErr('This add-on already exists.');
      return;
    }

    const newAddon: ApiAddon = {
      addOnId: crypto.randomUUID(),
      menuItemId: modal.item?.id ?? '',
      name,
      description: addonDescription.trim(),
      priceMinorUnits: Math.round(price * 100),
      isActive: true,
    };

    setAddons(prev => [...prev, newAddon]);
    setNewAddons(prev => [...prev, newAddon]);


    setAddonInput('');
    setAddonPrice('');
    setAddonDescription('');
    setSaveErr('');
  };

  const openModal = async (item?: ApiMenuItem) => {
    setModal({ open: true, item });

    setIsActive(item ? item.status === 'active' : true);
    setIsChef(item ? (item.tags ?? []).includes('chef') : false);
    setUploadFile(null);
    setUploadName(null);
    setGlbFile(null);
    setImagePreview(null);
    setGlbName(null);
    setGlbStatus('idle');
    setGlbError('');
    setSaveMsg('');
    setSaveErr('');
    setAddons([]);
    setAddonInput('');
    setAddonPrice('');
    setAddonDescription('');
    setItemImages([]);
    setItemImagePreviews([]);

    if (item?.id) {
      try {
        const existingAddons = await fetchMenuItemAddons(
          item.id,
          restaurantId
        );
        setExistingAddons(existingAddons ?? []);  // ✅ Track existing
        setAddons(existingAddons ?? []);          // Display all
      } catch (err) {
        console.error('Failed to load addons:', err);
        setExistingAddons([]);
        setAddons([]);
      }
    } else {
      setExistingAddons([]);
      setAddons([]);
    }

    let selectedCategory = '';

    if (item) {
      const itemCategoryId = String(
        item.categoryId ??
        (item as any).category?.id ??
        ''
      );

      const itemCategoryName = String(
        item.categoryName ??
        (item as any).category?.name ??
        (typeof (item as any).category === 'string'
          ? (item as any).category
          : '') ??
        ''
      ).trim().toLowerCase();

      const categoryById = cats.find(
        c => String(c.id) === itemCategoryId
      );

      const categoryByName = cats.find(
        c =>
          c.name.trim().toLowerCase() ===
          itemCategoryName
      );

      selectedCategory =
        categoryById?.id ??
        categoryByName?.id ??
        '';
    } else {
      selectedCategory = cats[0]?.id ?? '';
    }

    setForm({
      name: item?.name ?? '',
      description: item?.description ?? '',
      price:
        item?.price !== undefined && item?.price !== null
          ? String(item.price)
          : '',
      category: selectedCategory,
      prepTime: item?.prepTime ?? '',
      calories:
        item?.calories !== undefined &&
          item?.calories !== null
          ? String(item.calories)
          : '',
    });

    // ✅ Load sizes if editing
    if (item) {
      if (item.sizes && item.sizes.length > 0) {
        setSizes(item.sizes.map(s => ({
          name: s.name,
          price: String(s.price || 0),
        })));
      } else {
        setSizes([]);
      }

      // ✅ Load slides (existing images from API)
      if (item.slides && item.slides.length > 0) {
        setSlides(item.slides.map(s => ({
          file: null,
          preview: s.imageUrl || null,
        })));
      } else {
        setSlides([]);
      }
    } else {
      setSizes([]);
      setSlides([]);
    }
  };

  const uploadToS3 = async (url: string, file: File, ct: string) => {
    const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': ct }, body: file });
    if (!res.ok) throw new Error(`S3 upload failed (${res.status})`);
  };
  // Add this state
  const [newAddons, setNewAddons] = useState<ApiAddon[]>([]);
  const [existingAddons, setExistingAddons] = useState<ApiAddon[]>([]);

  const saveItem = async () => {
    if (!form.name.trim() || !form.price) { setSaveErr('Name and price are required.'); return; }
    if (cats.length === 0) { setSaveErr('Categories are still loading. Please wait a moment and try again.'); return; }
    if (!form.category) { setSaveErr('Please select a category.'); return; }
    if (!/^[0-9a-fA-F-]{36}$/.test(form.category)) {
      setSaveErr('Invalid category selected.');
      return;
    }

    setSaving(true);
    setSaveMsg('');
    setSaveErr('');

    try {
      let createdItemId: string | undefined;

      // ✅ Prepare sizes payload
      const sizesPayload = sizes
        .filter(size => size.name.trim() && size.price)
        .map(size => ({
          name: size.name.trim(),
          price: parseFloat(size.price),
        }));

      // ✅ Prepare slides payload
      const slidesPayload = slides
        .filter(slide => slide.preview || slide.file)
        .map((slide, index) => ({
          position: index + 1,
          imageKey: '', // Will be set by backend
        }));

      if (modal.item?.id) {
        // ── UPDATE EXISTING ITEM ──
        const version = (modal.item as any).version ?? 1;
        const raw = await updateMenuItem(
          restaurantId,
          modal.item.id,
          {
            name: form.name.trim(),
            description: form.description.trim(),
            price: parseFloat(form.price),
            categoryId: form.category,
            status: isActive ? 'active' : 'inactive',
            tags: isChef ? ['chef'] : [],
            prepTime: form.prepTime || '20 min',
            calories: form.calories ? parseInt(form.calories) : undefined,
            sizes: sizesPayload,
            slides: slidesPayload,
          },
          version
        );

        const updatedItemId = (raw as any).id ?? (raw as any).itemId;
        setItems(prev => prev.map(i => i.id === updatedItemId ? normaliseItem(raw) : i));
        setSaveMsg('Item updated with sizes & slides! ✓');
        createdItemId = updatedItemId;

        // Handle image upload for existing item
        if (uploadFile) {
          setSaveMsg('Getting image upload URL…');
          const fetched = await fetchMenuItem(modal.item.id, restaurantId) as any;
          if (fetched.imageUrl) {
            setSaveMsg('Uploading image…');
            await uploadToS3(fetched.imageUrl, uploadFile, uploadFile.type || 'image/png');
            setSaveMsg('Image uploaded! ✓');
          }
        }

        if (glbFile && !(modal.item as any).arModelKey) {
          setSaveErr('This item has no AR model slot. Use "Recreate & Upload Files" to create a fresh item with GLB.');
          setSaving(false);
          return;
        }
      } else {
        // ── CREATE NEW ITEM ──
        setSaveMsg('Creating item…');
        if (glbFile) {
          setGlbStatus('uploading');
          setSaveMsg('Uploading item + 3D model…');
        }

        // ✅ FIX: Pass itemImages for SLIDES to the API
        const raw = await createMenuItemWithFiles(
          restaurantId,
          {
            name: form.name.trim(),
            description: form.description.trim(),
            price: parseFloat(form.price),
            categoryId: form.category,
            isActive: true,
            // ✅ Fix: Send prepTime as number, not string with "min"
            prepTime: form.prepTime ? String(parseInt(form.prepTime.replace(/\D/g, '')) || 20) : undefined,
            calories: form.calories ? parseInt(form.calories) : undefined,
            sizes: sizesPayload,
            // ✅ Only send slides if there are images
            slides: slidesPayload.length > 0 ? slidesPayload : undefined,
          },
          uploadFile,
          glbFile,
          itemImages // ✅ Pass the actual file array here
        );

        const newItem = normaliseItem(raw);
        setItems(prev => [...prev, newItem]);
        createdItemId = newItem.id;

        if (raw.arModelKey) {
          setGlbStatus('approved');
          setSaveMsg('Item created with 3D model, sizes & slides! ✓');
        } else {
          setSaveMsg('Item created with sizes & slides! ✓');
        }
      }

      // ── CREATE ADDONS AFTER ITEM IS CREATED/UPDATED ──
      if (addons.length > 0 && createdItemId) {
        setSaveMsg('Creating add-ons...');
        for (const addon of addons) {
          await createAddon(  // ⚠️ HAR BAAR NAYA ADD-ON BAN RAHA HAI!
            restaurantId,
            createdItemId,
            {
              name: addon.name,
              description: addon.description || '',
              priceMinorUnits: addon.priceMinorUnits,
              isActive: addon.isActive,
              sortOrder: addon.sortOrder ?? 0,
            }
          );
        }
      }

      setTimeout(() => {
        setModal({ open: false });
        loadItems();
        setSaveMsg('');
      }, 1400);

    } catch (err: any) {
      setSaveErr(err?.message ?? 'Save failed.');
      if (glbStatus === 'uploading') {
        setGlbStatus('error');
        setGlbError(err?.message ?? 'Upload failed');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const item = deleteModal.item;
    if (!item?.id) return;
    setDeleting(item.id);
    try {
      await deleteMenuItem(item.id, restaurantId);
      setItems(prev => prev.filter(i => i.id !== item.id));
      setDeleteModal({ open: false });
    } catch (err: any) {
      console.error('DELETE ITEM ERROR:', err);
      setSaveErr(err?.message ?? 'Unable to delete item');
    } finally {
      setDeleting(null);
    }
  };

  const handleRecreate = async () => {
    if (!modal.item) return;

    setSaving(true);
    setSaveErr('');
    setSaveMsg('Deactivating old item…');

    try {
      const latest = await fetchMenuItem(
        modal.item.id,
        restaurantId
      ) as any;

      // 1. Deactivate old item
      await updateMenuItem(
        latest.restaurantId,
        latest.itemId ?? latest.id,
        {
          name: latest.name,
          description: latest.description,
          price: latest.price,
          categoryId: latest.categoryId,
          status: 'inactive',
          tags: latest.tags ?? [],
          prepTime: latest.prepTime,
          calories: latest.calories,
        },
        latest.version ?? 1
      );

      // 2. Create NEW item with files
      setSaveMsg('Creating fresh item…');

      const sizesPayload = sizes
        .filter(size => size.name.trim() && size.price)
        .map(size => ({
          name: size.name.trim(),
          price: parseFloat(size.price),
        }));

      const slidesPayload = slides
        .filter(slide => slide.preview || slide.file)
        .map((slide, index) => ({
          position: index + 1,
          imageKey: '',
        }));

      // ✅ FIX: Pass itemImages for SLIDES to the API
      const raw = await createMenuItemWithFiles(
        restaurantId,
        {
          name: form.name.trim(),
          description: form.description.trim(),
          price: parseFloat(form.price),
          categoryId: form.category,
          isActive,
          prepTime: form.prepTime || undefined,
          calories: form.calories
            ? parseInt(form.calories)
            : undefined,
          sizes: sizesPayload,
          slides: slidesPayload,
        },
        uploadFile,
        glbFile,
        itemImages // ✅ Pass the actual file array here
      );

      setItems(prev => [
        ...prev.filter(i => i.id !== modal.item!.id),
        normaliseItem(raw),
      ]);

      setGlbStatus(
        raw.arModelKey ? 'approved' : 'idle'
      );

      setSaveMsg(
        raw.arModelKey
          ? 'Recreated with 3D model, sizes & slides! ✓'
          : 'Recreated with sizes & slides! ✓'
      );

      setTimeout(() => {
        setModal({ open: false });
        loadItems();
      }, 1500);

    } catch (err: any) {
      setSaveErr(err?.message ?? 'Recreate failed.');
      setGlbStatus('error');
      setGlbError(err?.message ?? 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = (): React.CSSProperties => ({
    width: '100%',
    height: 42,
    borderRadius: 10,
    padding: '0 12px',
    background: colors.inputBg,
    border: `1.5px solid ${colors.border}`,
    fontSize: 13,
    color: colors.text,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: "'Poppins', sans-serif",
    transition: 'all 0.2s ease',
  });

  const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = BRAND;
    e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = colors.border;
    e.currentTarget.style.boxShadow = 'none';
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: colors.bg,
      fontFamily: "'Poppins', sans-serif",
    }}>
      <style>{`
        .animate-spin {
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'};
        }
        ::-webkit-scrollbar-thumb {
          background: ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'};
          border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: ${isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'};
        }
        input::placeholder,
        input::-webkit-input-placeholder,
        input::-moz-placeholder {
          color: ${colors.placeholder} !important;
          opacity: 0.8;
        }
        input:focus {
          outline: none;
        }
        textarea::placeholder,
        textarea::-webkit-input-placeholder,
        textarea::-moz-placeholder {
          color: ${colors.placeholder} !important;
          opacity: 0.8;
        }
        textarea:focus {
          outline: none;
        }
        select:focus {
          outline: none;
        }
        select option:disabled {
          color: ${colors.placeholder};
        }
      `}</style>

      {/* ── Top Bar ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        background: colors.card,
        borderBottom: `1.5px solid ${colors.border}`,
        flexShrink: 0,
        flexWrap: 'wrap',
        gap: 12,
        fontFamily: "'Poppins', sans-serif",
      }}>
        <div>
          <h1 style={{
            fontSize: 20,
            fontWeight: 800,
            color: colors.text,
            margin: 0,
            fontFamily: "'Poppins', sans-serif",
          }}>Menu Management</h1>
          <p style={{
            fontSize: 12,
            color: colors.muted,
            margin: '2px 0 0',
            fontFamily: "'Poppins', sans-serif",
          }}>Live API · {activeItems.length} active items</p>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: colors.subtle,
              pointerEvents: 'none'
            }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search items…"
              style={{
                height: 36,
                paddingLeft: 36,
                paddingRight: 14,
                borderRadius: 10,
                width: 200,
                fontSize: 13,
                background: colors.inputBg,
                border: `1.5px solid ${colors.border}`,
                color: colors.text,
                outline: 'none',
                fontFamily: "'Poppins', sans-serif",
                transition: 'all 0.2s ease',
              }}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          </div>

          <button
            onClick={loadItems}
            title="Refresh"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: colors.imageBg,
              border: `1.5px solid ${colors.imageBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
            onMouseEnter={(e) => {
              // e.currentTarget.style.background = colors.hoverBg;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = colors.imageBg;
            }}
          >
            <RefreshCw size={14} color={colors.bell} className={loadState === 'loading' ? 'animate-spin' : ''} />
          </button>

          <button
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: colors.inputBg,
              border: `1.5px solid ${colors.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
            onMouseEnter={(e) => {
              // e.currentTarget.style.background = colors.hoverBg;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = colors.inputBg;
            }}
          >
            <Bell size={15} color={colors.muted} />
          </button>

          <button
            onClick={() => openModal()}
            style={{
              height: 36,
              padding: '0 16px',
              borderRadius: 10,
              background: colors.imageBg,
              border: `1.5px solid ${colors.imageBorder}`,
              color: '#ffff',
              display: 'flex',
              alignItems: 'center',
              fontSize: 13,
              gap: 6,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: "'Poppins', sans-serif",
              transition: 'all 0.2s ease',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
            onMouseEnter={(e) => {
              // e.currentTarget.style.background = colors.hoverBg;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = colors.imageBg;
            }}
          >
            <Plus size={15} /> Add Item
          </button>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div style={{
        flex: 1,
        padding: '24px 24px',
        overflowY: 'auto',
        background: colors.bg,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        fontFamily: "'Poppins', sans-serif",
      }}>

        {/* Error */}
        {loadState === 'error' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 16px',
            background: isDark ? 'rgba(255,87,35,0.12)' : '#FFF0F0',
            border: `1.5px solid ${isDark ? 'rgba(255,87,35,0.3)' : '#FFD0D0'}`,
            borderRadius: 14,
          }}>
            <AlertCircle size={16} color={colors.danger} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{
                fontSize: 13,
                fontWeight: 700,
                color: colors.danger,
                margin: 0,
                fontFamily: "'Poppins', sans-serif",
              }}>
                Failed to load menu items
              </p>
              <p style={{
                fontSize: 12,
                color: colors.muted,
                margin: '2px 0 0',
                fontFamily: "'Poppins', sans-serif",
              }}>
                {loadError}
              </p>
            </div>
            <button
              onClick={loadItems}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                background: isDark ? 'rgba(255,87,35,0.12)' : '#FFF0F0',
                border: `1px solid ${isDark ? 'rgba(255,87,35,0.3)' : '#FFD0D0'}`,
                color: colors.danger,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: "'Poppins', sans-serif",
                transition: 'all 0.2s ease',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
          maxWidth: 360,
        }}>
          {[
            { label: 'Total Items', val: activeItems.length, color: colors.text },
            { label: 'Active', val: activeItems.length, color: BRAND },
          ].map(s => (
            <div key={s.label} style={{
              background: colors.card,
              border: `1.5px solid ${colors.border}`,
              borderRadius: 16,
              padding: '16px',
            }}>
              <p style={{
                fontSize: 10,
                color: colors.subtle,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: 'uppercase',
                margin: '0 0 6px',
                fontFamily: "'Poppins', sans-serif",
              }}>{s.label}</p>
              <p style={{
                fontSize: 28,
                fontWeight: 800,
                color: s.color,
                margin: 0,
                fontFamily: "'Poppins', sans-serif",
              }}>
                {loadState === 'loading' ? '…' : s.val}
              </p>
            </div>
          ))}
        </div>

        {/* Category filters */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[{ id: 'all', name: '🍽️ All' }, ...cats].map(cat => {
            const active = category === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                style={{
                  padding: '6px 16px',
                  borderRadius: 20,
                  border: `1.5px solid ${active ? BRAND : colors.border}`,
                  background: active ? colors.brandBg : colors.card,
                  color: active ? BRAND : colors.muted,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: "'Poppins', sans-serif",
                  transition: 'all 0.2s ease',
                  outline: 'none',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = colors.hoverBg;
                    e.currentTarget.style.color = colors.text;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = colors.card;
                    e.currentTarget.style.color = colors.muted;
                  }
                }}
              >
                {cat.name}
              </button>
            );
          })}
        </div>

        {/* Loading skeleton */}
        {loadState === 'loading' && (
          <div style={{
            background: colors.card,
            border: `1.5px solid ${colors.border}`,
            borderRadius: 16,
            overflow: 'hidden',
          }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 20px',
                borderBottom: `1px solid ${colors.border}`,
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: colors.inputBg }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ height: 10, width: '33%', background: colors.inputBg, borderRadius: 6 }} />
                  <div style={{ height: 8, width: '50%', background: colors.inputBg, borderRadius: 6 }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        {(loadState === 'success' || loadState === 'idle' || loadState === 'error') && (
          <div style={{
            background: colors.card,
            border: `1.5px solid ${colors.border}`,
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: `0 2px 8px ${isDark ? 'rgba(0,0,0,0.2)' : 'rgba(137,28,28,0.05)'}`,
          }}>
            {/* Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '44px 1fr 120px 90px 80px 90px 80px',
              gap: 12,
              padding: '10px 20px',
              borderBottom: `1.5px solid ${colors.border}`,
              background: colors.card2,
            }}>
              {['', 'Item', 'Category', 'Price', 'Rating', 'Status', 'Actions'].map(h => (
                <p key={h} style={{
                  fontSize: 10,
                  color: colors.subtle,
                  fontWeight: 700,
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                  margin: 0,
                  fontFamily: "'Poppins', sans-serif",
                }}>{h}</p>
              ))}
            </div>

            {/* Empty */}
            {filtered.length === 0 && loadState === 'success' && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px 0',
                gap: 12,
              }}>
                <span style={{ fontSize: 36, opacity: 0.2 }}>🍽️</span>
                <p style={{
                  fontSize: 13,
                  color: colors.subtle,
                  margin: 0,
                  fontFamily: "'Poppins', sans-serif",
                }}>No items found</p>
                <button
                  onClick={() => openModal()}
                  style={{
                    padding: '8px 20px',
                    borderRadius: 24,
                    background: colors.imageBg,
                    border: `1.5px solid ${colors.imageBorder}`,
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: "'Poppins', sans-serif",
                    transition: 'all 0.2s ease',
                    outline: 'none',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = colors.hoverBg;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = colors.imageBg;
                  }}
                >
                  Add First Item
                </button>
              </div>
            )}

            {/* Rows */}
            {filtered.map((item, idx) => (
              <div key={item.id ?? `item-${idx}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '44px 1fr 120px 90px 80px 90px 80px',
                  gap: 12,
                  padding: '12px 20px',
                  borderBottom: `1px solid ${colors.border}`,
                  alignItems: 'center',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = colors.card2}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}>

                {/* Thumb */}
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: colors.imageBg,
                    border: `1px solid ${colors.imageBorder}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    overflow: 'hidden',
                    flexShrink: 0,
                    position: 'relative',
                  }}
                >
                  {(item as any).imageUrl ? (
                    <Image
                      src={(item as any).imageUrl}
                      alt={item.name}
                      fill
                      sizes="40px"
                      unoptimized
                      style={{
                        objectFit: 'cover',
                        borderRadius: 10,
                      }}
                    />
                  ) : (
                    <span>{item.emoji}</span>
                  )}
                </div>

                {/* Name */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <p style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: colors.text,
                      margin: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontFamily: "'Poppins', sans-serif",
                    }}>{item.name}</p>
                    {(item as any).arModelKey && (
                      <span style={{
                        fontSize: 9,
                        background: colors.glbBg,
                        border: `1px solid ${colors.glbBorder}`,
                        color: colors.glbText,
                        padding: '2px 6px',
                        borderRadius: 10,
                        fontWeight: 700,
                        flexShrink: 0,
                        fontFamily: "'Poppins', sans-serif",
                      }}>3D</span>
                    )}
                  </div>
                  <p style={{
                    fontSize: 11,
                    color: colors.subtle,
                    margin: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontFamily: "'Poppins', sans-serif",
                  }}>{item.description}</p>
                </div>

                <p style={{
                  fontSize: 12,
                  color: colors.muted,
                  margin: 0,
                  fontFamily: "'Poppins', sans-serif",
                }}>
                  {item.categoryName || item.category || "—"}
                </p>
                <p style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: BRAND,
                  margin: 0,
                  fontFamily: "'Poppins', sans-serif",
                }}>{formatPrice(item.price)}</p>
                <p style={{
                  fontSize: 12,
                  color: colors.warning,
                  fontWeight: 600,
                  margin: 0,
                  fontFamily: "'Poppins', sans-serif",
                }}>★ {item.rating?.toFixed(1) ?? '—'}</p>

                {/* Status */}
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '4px 10px',
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 700,
                  background: item.status === 'active' ? colors.statusBg : colors.inactiveBg,
                  color: item.status === 'active' ? colors.statusText : colors.inactiveText,
                  border: `1px solid ${item.status === 'active' ? colors.statusBorder : colors.inactiveBorder}`,
                  fontFamily: "'Poppins', sans-serif",
                }}>
                  <span style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: item.status === 'active' ? colors.activeDot : colors.inactiveDot,
                    display: 'inline-block',
                  }} />
                  {item.status}
                </span>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => openModal(item)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: colors.imageBg,
                      border: `1px solid ${colors.imageBorder}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      outline: 'none',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    onMouseEnter={(e) => {

                      e.currentTarget.style.borderColor = BRAND;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = colors.imageBg;
                      e.currentTarget.style.borderColor = colors.imageBorder;
                    }}
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={() => setDeleteModal({ open: true, item })}
                    disabled={deleting === item.id}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: isDark ? 'rgba(255,87,35,0.12)' : '#FFF0F0',
                      border: `1px solid ${isDark ? 'rgba(255,87,35,0.3)' : '#FFD0D0'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      opacity: deleting === item.id ? 0.4 : 1,
                      transition: 'all 0.2s ease',
                      outline: 'none',
                    }}
                    onFocus={(e) => {
                      if (deleting !== item.id) {
                        e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
                      }
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {deleting === item.id ? <Loader2 size={12} color={colors.subtle} className="animate-spin" /> : <Trash2 size={12} color={colors.danger} />}
                  </button>
                </div>
              </div>
            ))}

            {/* Footer */}
            {(loadState === 'success' || loadState === 'idle') && activeItems.length > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 20px',
                borderTop: `1.5px solid ${colors.border}`,
                background: colors.card2,
              }}>
                <p style={{
                  fontSize: 11,
                  color: colors.subtle,
                  margin: 0,
                  fontFamily: "'Poppins', sans-serif",
                }}>Showing {filtered.length} of {activeItems.length} active items</p>
                <p style={{
                  fontSize: 11,
                  color: colors.subtle,
                  fontFamily: 'monospace',
                  margin: 0,
                }}>Source: AWS API Gateway</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      {modal.open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: colors.modalOverlay,
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: 24,
          }}
          onClick={e => e.target === e.currentTarget && setModal({ open: false })}
        >
          <div style={{
            background: colors.card,
            border: `1.5px solid ${colors.border}`,
            borderRadius: 24,
            width: 460,
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: 24,
            boxShadow: `0 20px 60px ${colors.shadow}`,
            fontFamily: "'Poppins', sans-serif",
          }}>

            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h2 style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: colors.text,
                  margin: 0,
                  fontFamily: "'Poppins', sans-serif",
                }}>{modal.item ? 'Edit Menu Item' : 'Add Menu Item'}</h2>
                <p style={{
                  fontSize: 11,
                  color: colors.subtle,
                  margin: '2px 0 0',
                  fontFamily: "'Poppins', sans-serif",
                }}>{modal.item ? `ID: ${modal.item.id?.slice(0, 8)}…` : 'POST to AWS API Gateway'}</p>
              </div>
              <button
                onClick={() => setModal({ open: false })}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: colors.inputBg,
                  border: `1.5px solid ${colors.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  outline: 'none',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = colors.hoverBg;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = colors.inputBg;
                }}
              >
                <X size={14} color={colors.muted} />
              </button>
            </div>

            {/* Alerts */}
            {saveMsg && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                background: colors.statusBg,
                border: `1px solid ${colors.statusBorder}`,
                borderRadius: 12,
                marginBottom: 14,
              }}>
                <CheckCircle size={14} color={colors.statusText} />
                <p style={{
                  fontSize: 12,
                  color: colors.statusText,
                  fontWeight: 600,
                  margin: 0,
                  fontFamily: "'Poppins', sans-serif",
                }}>{saveMsg}</p>
              </div>
            )}
            {saveErr && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                background: isDark ? 'rgba(255,87,35,0.12)' : '#FFF0F0',
                border: `1px solid ${isDark ? 'rgba(255,87,35,0.3)' : '#FFD0D0'}`,
                borderRadius: 12,
                marginBottom: 14,
              }}>
                <AlertCircle size={14} color={colors.danger} />
                <p style={{
                  fontSize: 12,
                  color: colors.danger,
                  margin: 0,
                  fontFamily: "'Poppins', sans-serif",
                }}>{saveErr}</p>
              </div>
            )}

            {/* Form fields */}
            <div style={{ marginBottom: 14 }}>
              <FieldLabel>Item Name *</FieldLabel>
              <input
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Chicken Karahi"
                style={inputStyle()}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <FieldLabel>{!form.category ? <span style={{ color: colors.warning }}>Category ⚠</span> : 'Category'}</FieldLabel>
                <select
                  value={form.category}
                  onChange={e =>
                    setForm(p => ({
                      ...p,
                      category: e.target.value,
                    }))
                  }
                  style={{ ...inputStyle(), appearance: 'none' as any }}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                >
                  {cats.length === 0 ? (
                    <option value="">Loading categories...</option>
                  ) : (
                    <>
                      <option value="">Select category</option>
                      {cats.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>
              <div>
                <FieldLabel>Price (Rs) *</FieldLabel>
                <input
                  type="number"
                  value={form.price}
                  onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                  placeholder="0"
                  style={inputStyle()}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
              </div>
            </div>

            {/* Description */}
            <div style={{ marginBottom: 14 }}>
              <FieldLabel>Description</FieldLabel>
              <textarea
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Short description…"
                rows={2}
                style={{
                  ...inputStyle(),
                  height: 'auto',
                  padding: '10px 12px',
                  resize: 'none',
                  fontFamily: "'Poppins', sans-serif",
                } as React.CSSProperties}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            {/* ── Sizes ── */}
            <div style={{ marginBottom: 14 }}>
              <FieldLabel>Sizes (Small, Medium, Large)</FieldLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sizes.map((size, index) => (
                  <div key={index} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="text"
                      value={size.name}
                      onChange={(e) => {
                        const updated = [...sizes];
                        updated[index] = { ...updated[index], name: e.target.value };
                        setSizes(updated);
                      }}
                      placeholder="Small"
                      style={{ ...inputStyle(), flex: 1 }}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                    />
                    <input
                      type="number"
                      value={size.price}
                      onChange={(e) => {
                        const updated = [...sizes];
                        updated[index] = { ...updated[index], price: e.target.value };
                        setSizes(updated);
                      }}
                      placeholder="Price"
                      style={{ ...inputStyle(), flex: 1 }}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                    />
                    <button
                      type="button"
                      onClick={() => setSizes(prev => prev.filter((_, i) => i !== index))}
                      style={{
                        height: 42,
                        padding: '0 14px',
                        borderRadius: 10,
                        background: colors.imageBg,
                        border: `1.5px solid ${colors.imageBorder}`,
                        color: "#ffffff",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: "'Poppins', sans-serif",
                        transition: 'all 0.2s ease',
                        outline: 'none',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setSizes(prev => [...prev, { name: '', price: '' }])}
                  style={{
                    height: 42,
                    padding: '0 14px',
                    borderRadius: 10,
                    background: BRAND,
                    border: `1.5px solid ${colors.imageBorder}`,
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: "'Poppins', sans-serif",
                    transition: 'all 0.2s ease',
                    outline: 'none',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  + Add Size
                </button>
              </div>
            </div>

            {/* ── Slides (Multiple Images) ── */}
            <div style={{ marginBottom: 14 }}>
              <FieldLabel>
                Slides (Additional Images)
                <span style={{
                  color: colors.subtle,
                  fontSize: 10,
                  marginLeft: 6,
                  textTransform: 'none',
                  letterSpacing: 0,
                  fontFamily: "'Poppins', sans-serif",
                }}>
                  Max 6 images
                </span>
              </FieldLabel>

              {/* Existing slides preview */}
              {slides.map((slide, index) => (
                <div key={index} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '8px 12px',
                  marginBottom: 8,
                  borderRadius: 10,
                  background: colors.inputBg,
                  border: `1px solid ${colors.border}`,
                }}>
                  {slide.preview ? (
                    <Image
                      src={slide.preview}
                      alt={`Slide ${index + 1}`}
                      width={50}
                      height={50}
                      unoptimized
                      style={{
                        objectFit: 'cover',
                        borderRadius: 8,
                      }}
                    />
                  ) : (
                    <div style={{
                      width: 50,
                      height: 50,
                      borderRadius: 8,
                      background: colors.card2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                    }}>
                      🖼️
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <p style={{
                      fontSize: 12,
                      color: colors.text,
                      fontWeight: 600,
                      margin: 0,
                      fontFamily: "'Poppins', sans-serif",
                    }}>
                      Slide {index + 1}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      // ✅ Fix: Clean up both slide and itemImages state
                      const fileToRemove = slides[index].file;
                      setSlides(prev => prev.filter((_, i) => i !== index));
                      if (fileToRemove) {
                        setItemImages(prev => prev.filter((_, i) => i !== index));
                        setItemImagePreviews(prev => prev.filter((_, i) => i !== index));
                      }
                    }}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      background: isDark ? 'rgba(255,87,35,0.12)' : '#FFF0F0',
                      border: `1px solid ${isDark ? 'rgba(255,87,35,0.3)' : '#FFD0D0'}`,
                      color: colors.danger,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: "'Poppins', sans-serif",
                      transition: 'all 0.2s ease',
                      outline: 'none',
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}

              {/* Add new slide (Multiple files support) */}
              {slides.length < 6 && (
                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    padding: 16,
                    borderRadius: 12,
                    border: `2px dashed ${colors.border}`,
                    background: colors.inputBg,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontFamily: "'Poppins', sans-serif",
                  }}
                >
                  {/* ✅ CHANGE: added 'multiple' attribute to select multiple files at once */}
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files && files.length > 0) {
                        // ✅ Loop through all selected files
                        const newSlides: { file: File | null; preview: string | null }[] = [];
                        const newItemImages: File[] = [];
                        const newPreviews: string[] = [];

                        // Only take files until we reach max 6 slides
                        const remainingSlots = 6 - slides.length;
                        const filesToAdd = Math.min(files.length, remainingSlots);

                        for (let i = 0; i < filesToAdd; i++) {
                          const file = files[i];
                          const previewUrl = URL.createObjectURL(file);

                          newSlides.push({ file, preview: previewUrl });
                          newItemImages.push(file);
                          newPreviews.push(previewUrl);
                        }

                        // Add to state
                        setSlides(prev => [...prev, ...newSlides]);
                        setItemImages(prev => [...prev, ...newItemImages]);
                        setItemImagePreviews(prev => [...prev, ...newPreviews]);
                      }
                    }}
                  />
                  <CloudUpload size={20} color={colors.subtle} />
                  <span style={{
                    fontSize: 12,
                    color: colors.subtle,
                    fontFamily: "'Poppins', sans-serif",
                  }}>
                    Add Slide Images ({slides.length}/6) · Select multiple
                  </span>
                </label>
              )}
            </div>

            {/* Add-ons */}
            <div style={{ marginBottom: 14 }}>
              <FieldLabel>Add-ons</FieldLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 8, marginBottom: 8 }}>
                <input
                  value={addonInput}
                  onChange={e => setAddonInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addAddon();
                    }
                  }}
                  placeholder="e.g. Extra Chocolate"
                  style={inputStyle()}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
                <input
                  type="number"
                  value={addonPrice}
                  onChange={e => setAddonPrice(e.target.value)}
                  placeholder="Price"
                  style={inputStyle()}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={addonDescription}
                  onChange={e => setAddonDescription(e.target.value)}
                  placeholder="Description"
                  style={{ ...inputStyle(), flex: 1 }}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
                <button
                  type="button"
                  onClick={addAddon}
                  style={{
                    height: 42,
                    padding: '0 14px',
                    borderRadius: 10,
                    background: "rgb(255, 87, 35)",
                    border: `1.5px solid ${colors.imageBorder}`,
                    color: "#ffff",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: "'Poppins', sans-serif",
                    transition: 'all 0.2s ease',
                    outline: 'none',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  + Add
                </button>
              </div>

              {addons.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 10 }}>
                  {addons.map(addon => (
                    <div
                      key={addon.addOnId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '9px 11px',
                        borderRadius: 12,
                        background: colors.imageBg,
                        border: `1px solid ${colors.imageBorder}`,
                      }}
                    >
                      {editingAddon?.addOnId === addon.addOnId ? (
                        // ── Edit Mode ──
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <input
                              value={addonEditName}
                              onChange={e => setAddonEditName(e.target.value)}
                              placeholder="Name"
                              style={{
                                ...inputStyle(),
                                flex: 1,
                                height: 32,
                                padding: '0 8px',
                                fontSize: 12,
                              }}
                              onFocus={handleFocus}
                              onBlur={handleBlur}
                            />
                            <input
                              type="number"
                              value={addonEditPrice}
                              onChange={e => setAddonEditPrice(e.target.value)}
                              placeholder="Price"
                              style={{
                                ...inputStyle(),
                                width: 80,
                                height: 32,
                                padding: '0 8px',
                                fontSize: 12,
                              }}
                              onFocus={handleFocus}
                              onBlur={handleBlur}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <input
                              value={addonEditDescription}
                              onChange={e => setAddonEditDescription(e.target.value)}
                              placeholder="Description"
                              style={{
                                ...inputStyle(),
                                flex: 1,
                                height: 32,
                                padding: '0 8px',
                                fontSize: 12,
                              }}
                              onFocus={handleFocus}
                              onBlur={handleBlur}
                            />
                            <button
                              type="button"
                              onClick={updateAddonHandler}
                              disabled={saving}
                              style={{
                                height: 32,
                                padding: '0 14px',
                                borderRadius: 8,
                                background: BRAND,
                                border: 'none',
                                color: '#fff',
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: saving ? 'not-allowed' : 'pointer',
                                opacity: saving ? 0.6 : 1,
                                fontFamily: "'Poppins', sans-serif",
                              }}
                            >
                              {saving ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingAddon(null);
                                setAddonEditName('');
                                setAddonEditPrice('');
                                setAddonEditDescription('');
                              }}
                              style={{
                                height: 32,
                                padding: '0 10px',
                                borderRadius: 8,
                                background: 'transparent',
                                border: `1px solid ${colors.border}`,
                                color: colors.muted,
                                fontSize: 11,
                                cursor: 'pointer',
                                fontFamily: "'Poppins', sans-serif",
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        // ── View Mode ──
                        <>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: "#ffff",
                              fontFamily: "'Poppins', sans-serif",
                            }}>
                              {addon.name}
                            </div>
                            {addon.description && (
                              <div style={{
                                fontSize: 10,
                                color: colors.subtle,
                                marginTop: 2,
                                fontFamily: "'Poppins', sans-serif",
                              }}>
                                {addon.description}
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: BRAND,
                              fontFamily: "'Poppins', sans-serif",
                            }}>
                              Rs. {(addon.priceMinorUnits / 100).toFixed(0)}
                            </span>

                            {/* Edit Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingAddon(addon);
                                setAddonEditName(addon.name);
                                setAddonEditPrice(String(addon.priceMinorUnits / 100));
                                setAddonEditDescription(addon.description || '');
                              }}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: '#ffff',
                                cursor: 'pointer',
                                padding: 2,
                                transition: 'all 0.2s ease',
                                outline: 'none',
                                opacity: 0.7,
                              }}
                              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                              onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
                            >
                              <Edit2 size={12} />
                            </button>

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => setAddons(prev => prev.filter(a => a.addOnId !== addon.addOnId))}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: colors.danger,
                                cursor: 'pointer',
                                padding: 2,
                                transition: 'all 0.2s ease',
                                outline: 'none',
                              }}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Prep + Calories */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <FieldLabel>Prep Time</FieldLabel>
                <input
                  value={form.prepTime}
                  onChange={e => setForm(p => ({ ...p, prepTime: e.target.value }))}
                  placeholder="e.g. 25 min"
                  style={inputStyle()}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
              </div>
              <div>
                <FieldLabel>Calories</FieldLabel>
                <input
                  type="number"
                  value={form.calories}
                  onChange={e => setForm(p => ({ ...p, calories: e.target.value }))}
                  placeholder="e.g. 680"
                  style={inputStyle()}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
              </div>
            </div>

            {/* Image upload */}
            <div style={{ marginBottom: 14 }}>
              <FieldLabel
                extra={modal.item && !(modal.item as any).imageKey ? <span style={{ color: colors.warning, fontSize: 11, fontFamily: "'Poppins', sans-serif" }}>— no image yet</span> : modal.item && (modal.item as any).imageKey ? <span style={{ color: colors.statusText, fontSize: 11, fontFamily: "'Poppins', sans-serif" }}>✓ uploaded</span> : null}
              >
                Item Image
              </FieldLabel>
              <label
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  padding: 20,
                  borderRadius: 16,
                  border: `2px dashed ${uploadName ? colors.imageBorder : colors.border}`,
                  background: uploadName ? colors.imageBg : colors.inputBg,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const f = e.target.files?.[0] ?? null;
                    setUploadFile(f);
                    setUploadName(f?.name ?? null);
                    if (f) {
                      const previewUrl = URL.createObjectURL(f);
                      setImagePreview(previewUrl);
                    } else {
                      setImagePreview(null);
                    }
                  }}
                />
                <CloudUpload size={24} color={uploadName ? colors.text : colors.subtle} />
                <span style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: uploadName ? colors.text : colors.subtle,
                  fontFamily: "'Poppins', sans-serif",
                }}>{uploadName ? `✓ ${uploadName}` : 'Click to upload · PNG, JPG'}</span>
              </label>
              {imagePreview && (
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center' }}>
                  <Image
                    src={imagePreview}
                    alt="Selected item"
                    width={90}
                    height={90}
                    unoptimized
                    style={{
                      objectFit: 'cover',
                      borderRadius: 12,
                      border: `1px solid ${colors.border}`,
                    }}
                  />
                </div>
              )}
            </div>

            {/* GLB upload */}
            <div style={{ marginBottom: 14 }}>
              <FieldLabel
                extra={modal.item && !(modal.item as any).arModelKey ? <span style={{ color: colors.warning, fontSize: 11, fontFamily: "'Poppins', sans-serif" }}>— no model yet</span> : modal.item && (modal.item as any).arModelKey ? <span style={{ color: colors.statusText, fontSize: 11, fontFamily: "'Poppins', sans-serif" }}>✓ uploaded</span> : null}
              >
                3D AR Model (.glb)
              </FieldLabel>
              {glbStatus === 'idle' && (
                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    padding: 20,
                    borderRadius: 16,
                    border: `2px dashed ${glbName ? colors.glbBorder : colors.border}`,
                    background: glbName ? colors.glbBg : colors.inputBg,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontFamily: "'Poppins', sans-serif",
                  }}
                >
                  <input
                    type="file"
                    accept=".glb,.gltf"
                    style={{ display: 'none' }}
                    onChange={e => {
                      const f = e.target.files?.[0] ?? null;
                      setGlbFile(f);
                      setGlbName(f?.name ?? null);
                      setGlbError('');
                    }}
                  />
                  <span style={{ fontSize: 24 }}>🫙</span>
                  <span style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: glbName ? colors.glbText : colors.subtle,
                    fontFamily: "'Poppins', sans-serif",
                  }}>{glbName ? `✓ ${glbName}` : 'Click to upload · .glb / .gltf'}</span>
                  {glbName && !modal.item && <span style={{
                    fontSize: 11,
                    color: colors.glbText,
                    opacity: 0.7,
                    fontFamily: "'Poppins', sans-serif",
                  }}>Will upload with item on Save</span>}
                  {glbName && modal.item && <span style={{
                    fontSize: 11,
                    color: colors.warning,
                    opacity: 0.8,
                    fontFamily: "'Poppins', sans-serif",
                  }}>Use Recreate button below to attach GLB</span>}
                </label>
              )}
              {glbStatus === 'uploading' && (
                <div style={{
                  padding: '14px 16px',
                  borderRadius: 16,
                  border: `2px dashed ${colors.glbBorder}`,
                  background: colors.glbBg,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <Loader2 size={13} color={colors.glbText} className="animate-spin" />
                  <span style={{
                    fontSize: 12,
                    color: colors.glbText,
                    fontWeight: 600,
                    fontFamily: "'Poppins', sans-serif",
                  }}>{saveMsg || 'Uploading 3D model…'}</span>
                </div>
              )}
              {glbStatus === 'approved' && (
                <div style={{
                  padding: '14px 16px',
                  borderRadius: 16,
                  border: `2px dashed ${colors.statusBorder}`,
                  background: colors.statusBg,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}>
                  <CheckCircle size={20} color={colors.statusText} style={{ flexShrink: 0 }} />
                  <div>
                    <p style={{
                      fontSize: 12,
                      color: colors.statusText,
                      fontWeight: 700,
                      margin: 0,
                      fontFamily: "'Poppins', sans-serif",
                    }}>✓ 3D Model Uploaded</p>
                    <p style={{
                      fontSize: 11,
                      color: colors.statusText,
                      opacity: 0.6,
                      margin: '2px 0 0',
                      fontFamily: "'Poppins', sans-serif",
                    }}>Refresh to see AR badge on item</p>
                  </div>
                </div>
              )}
              {glbStatus === 'error' && (
                <div style={{
                  padding: '14px 16px',
                  borderRadius: 16,
                  border: `2px dashed ${isDark ? 'rgba(255,87,35,0.3)' : '#FFD0D0'}`,
                  background: isDark ? 'rgba(255,87,35,0.12)' : '#FFF0F0',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <AlertCircle size={14} color={colors.danger} style={{ flexShrink: 0 }} />
                    <p style={{
                      fontSize: 12,
                      color: colors.danger,
                      fontWeight: 700,
                      margin: 0,
                      fontFamily: "'Poppins', sans-serif",
                    }}>Upload Error</p>
                  </div>
                  <p style={{
                    fontSize: 11,
                    color: colors.muted,
                    margin: '0 0 8px',
                    fontFamily: "'Poppins', sans-serif",
                  }}>{glbError}</p>
                  <button
                    onClick={() => { setGlbStatus('idle'); setGlbFile(null); setGlbName(null); }}
                    style={{
                      fontSize: 11,
                      color: colors.danger,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      padding: 0,
                      fontFamily: "'Poppins', sans-serif",
                      transition: 'all 0.2s ease',
                      outline: 'none',
                    }}
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>

            {/* Recreate warning */}
            {modal.item && glbFile && (
              <div style={{
                marginBottom: 14,
                padding: '12px 14px',
                background: isDark ? 'rgba(251,146,60,0.15)' : '#FFFBEB',
                border: `1px solid ${isDark ? 'rgba(251,146,60,0.3)' : '#FDE68A'}`,
                borderRadius: 14,
              }}>
                <p style={{
                  fontSize: 11,
                  color: isDark ? '#fb923c' : '#92400e',
                  fontWeight: 700,
                  margin: '0 0 8px',
                  fontFamily: "'Poppins', sans-serif",
                }}>⚠ GLB upload requires recreating the item.</p>
                <button
                  onClick={handleRecreate}
                  disabled={saving}
                  style={{
                    width: '100%',
                    height: 36,
                    borderRadius: 10,
                    background: colors.warning,
                    color: '#fff',
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontFamily: "'Poppins', sans-serif",
                    opacity: saving ? 0.6 : 1,
                    transition: 'all 0.2s ease',
                    outline: 'none',
                  }}
                  onFocus={(e) => {
                    if (!saving) {
                      e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
                    }
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {saving ? <><Loader2 size={13} className="animate-spin" /> {saveMsg}</> : '🔄 Recreate & Upload Files'}
                </button>
              </div>
            )}

            {/* Toggles */}
            <div style={{ borderTop: `1px solid ${colors.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
                <span style={{
                  fontSize: 13,
                  color: colors.muted,
                  fontFamily: "'Poppins', sans-serif",
                }}>Active on guest menu</span>
                <Toggle checked={isActive} onChange={setIsActive} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: `1px solid ${colors.border}` }}>
                <span style={{
                  fontSize: 13,
                  color: colors.muted,
                  fontFamily: "'Poppins', sans-serif",
                }}>Mark as Chef's Special</span>
                <Toggle checked={isChef} onChange={setIsChef} />
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button
                onClick={() => setModal({ open: false })}
                style={{
                  width: '50%',
                  height: 40,
                  borderRadius: 10,
                  background: colors.inputBg,
                  border: `1.5px solid ${colors.border}`,
                  color: colors.muted,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: "'Poppins', sans-serif",
                  transition: 'all 0.2s ease',
                  outline: 'none',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = colors.hoverBg;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = colors.inputBg;
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveItem}
                disabled={saving || glbStatus === 'uploading' || (cats.length === 0 && !modal.item)}
                style={{
                  width: '50%',
                  height: 40,
                  padding: '0 14px',
                  borderRadius: 10,
                  background: "rgb(255, 87, 35)",
                  border: `1.5px solid ${colors.imageBorder}`,
                  color: "#ffff",
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: "'Poppins', sans-serif",
                  opacity: (saving || glbStatus === 'uploading' || (cats.length === 0 && !modal.item)) ? 0.5 : 1,
                  transition: 'all 0.2s ease',
                  outline: 'none',
                }}
                onFocus={(e) => {
                  if (!saving && glbStatus !== 'uploading' && (cats.length > 0 || modal.item)) {
                    e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
                  }
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                }}
                onMouseEnter={(e) => {
                  if (!saving && glbStatus !== 'uploading' && (cats.length > 0 || modal.item)) {

                  }
                }}
                onMouseLeave={(e) => {
                  if (!saving && glbStatus !== 'uploading' && (cats.length > 0 || modal.item)) {
                    e.currentTarget.style.background = colors.imageBg;
                  }
                }}
              >
                {saving || glbStatus === 'uploading'
                  ? <><Loader2 size={14} className="animate-spin" /> {saveMsg || 'Saving…'}</>
                  : cats.length === 0 && !modal.item ? '⏳ Loading categories…'
                    : modal.item ? '✓ Update Item' : '✓ Create Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Delete Modal ── */}
      <ConfirmDeleteModal
        open={deleteModal.open}
        title="Delete Menu Item"
        message="Are you sure you want to delete this menu item?"
        itemName={deleteModal.item?.name}
        onCancel={() => {
          if (!deleting) {
            setDeleteModal({ open: false });
          }
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
}