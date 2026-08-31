'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Receipt,
  Loader2,
  RefreshCw,
  AlertCircle,
  Search,
  X,
  Printer,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import BranchPicker from '@/components/BranchPicker';

import {
  fetchMyBranches,
  fetchOrders,
  type Branch,
  type BranchOrder,
} from '@/lib/tenant-api';

import {
  money,
  STATUS_LABEL,
  STATUS_COLOR,
  derivedStatus,
  orderTypeOf,
  destinationOf,
  ORDER_TYPE_LABEL,
  ORDER_TYPE_COLOR,
  type OrderStatus,
  type OrderType,
} from '@/lib/support-api';

import { getTheme } from '@/lib/theme';

// ── Brand Color ──
const BRAND = '#ff5723';

// ── Theme-based colors ──
const getColors = (isDark: boolean) => ({
  bg: isDark ? '#111111' : '#FFFFFF',
  card: isDark ? '#1C1C1C' : '#FFFFFF',
  card2: isDark ? '#242424' : '#F5F5F5',
  border: isDark ? 'rgba(255,255,255,0.08)' : '#F0EBE6',
  text: isDark ? '#F5F0E8' : '#000000',
  muted: isDark ? '#9CA3AF' : '#6B6B6B',
  subtle: isDark ? '#6B7280' : '#6B6B6B',
  brand: BRAND,
  brandBg: 'rgba(255,87,35,0.12)',
  hoverBg: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6',
  focusRing: isDark
    ? 'rgba(255,87,35,0.2)'
    : 'rgba(255,87,35,0.15)',
});

const RANGES = [
  { label: 'Last 4 hours', hours: 4 },
  { label: 'Last 12 hours', hours: 12 },
  { label: 'Last 24 hours', hours: 24 },
];

const FILTERS: (OrderStatus | 'all')[] = [
  'all',
  'delivered',
  'cancelled',
  'ready',
  'preparing',
  'pending',
];

const PAGE_SIZE = 10;

// ── Helpers ──

const getItemsTotal = (order: BranchOrder): number => {
  return (order.lineItems || []).reduce((sum, li) => {
    return sum + (li.unitPriceMinorUnits || 0) * li.quantity;
  }, 0);
};

type OrderAddOn = {
  name: string;
  priceMinorUnits?: number;
  quantity?: number;
};

const getLineAddOns = (
  lineItem: NonNullable<BranchOrder['lineItems']>[number]
): OrderAddOn[] => {
  return (
    (lineItem as typeof lineItem & {
      addOns?: OrderAddOn[];
    }).addOns || []
  );
};

const getAddOnsTotal = (order: BranchOrder): number => {
  return (order.lineItems || []).reduce((sum, li) => {
    const addOnsTotal = getLineAddOns(li).reduce((s, a) => {
      return (
        s +
        (a.priceMinorUnits || 0) * (a.quantity || 1)
      );
    }, 0);

    return sum + addOnsTotal;
  }, 0);
};

const getGrandTotal = (order: BranchOrder): number => {
  return getItemsTotal(order) + getAddOnsTotal(order);
};

const getItemNames = (order: BranchOrder): string => {
  const grouped = new Map<string, number>();

  (order.lineItems || []).forEach((li) => {
    const name = li.name.trim();
    grouped.set(
      name,
      (grouped.get(name) || 0) + li.quantity
    );
  });

  return Array.from(grouped.entries())
    .map(([name, quantity]) => `${quantity}× ${name}`)
    .join(', ');
};

const getAddOnDetails = (order: BranchOrder): string => {
  const addOns = (order.lineItems || []).flatMap((li) =>
    getLineAddOns(li).map((a) => ({
      name: a.name,
      quantity: a.quantity || 1,
      price:
        (a.priceMinorUnits || 0) * (a.quantity || 1),
    }))
  );

  if (addOns.length === 0) return '—';

  return addOns
    .map(
      (a) =>
        `${a.name} ×${a.quantity} (${money(
          a.price,
          'PKR'
        )})`
    )
    .join(', ');
};

export default function TenantHistory() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [hours, setHours] = useState(24);
  const [orders, setOrders] = useState<BranchOrder[]>([]);

  const [loadingB, setLoadB] = useState(true);
  const [loadingO, setLoadO] = useState(false);
  const [error, setError] = useState('');

  const [filter, setFilter] =
    useState<OrderStatus | 'all'>('all');

  const [query, setQuery] = useState('');

  const [typeFilter, setTypeFilter] =
    useState<OrderType | 'all'>('all');

  const [printingOrderId, setPrintingOrderId] =
    useState<string | null>(null);

  const [printingAll, setPrintingAll] = useState(false);
  const [isDark, setIsDark] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);

  const printRef = useRef<HTMLDivElement>(null);
  // Prevent duplicate / simultaneous order API requests
  const ordersRequestRef = useRef(0);
  const isLoadingOrdersRef = useRef(false);
  // ── Theme listener ──
  useEffect(() => {
    const updateTheme = () => {
      const theme = getTheme();
      setIsDark(theme === 'dark');
    };

    updateTheme();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'admin_theme') {
        updateTheme();
      }
    };

    const handleThemeToggle = () => updateTheme();

    window.addEventListener('storage', handleStorage);
    window.addEventListener('themeChange', handleThemeToggle);

    return () => {
      window.removeEventListener(
        'storage',
        handleStorage
      );
      window.removeEventListener(
        'themeChange',
        handleThemeToggle
      );
    };
  }, []);

  const colors = getColors(isDark);

  // ── Load branches ONCE ──
  useEffect(() => {
    let cancelled = false;

    fetchMyBranches()
      .then((data) => {
        if (!cancelled) {
          setBranches(data);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(
            e?.message ??
            'Could not load your restaurants'
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadB(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * IMPORTANT:
   * This is NOT polling.
   *
   * There is:
   * - no setInterval
   * - no setTimeout
   * - no recursive load()
   * - no orderId/detail request here
   *
   * fetchOrders() is called only when:
   * 1. branches become available
   * 2. branch changes
   * 3. hours changes
   * 4. user clicks Refresh
   */
  const load = useCallback(async () => {
    if (branches.length === 0) return;

    // Prevent duplicate/simultaneous requests
    if (isLoadingOrdersRef.current) return;

    isLoadingOrdersRef.current = true;

    // Give this request a unique id
    const requestId = ++ordersRequestRef.current;

    setLoadO(true);
    setError('');

    try {
      const result = await fetchOrders(
        branches,
        branchId,
        hours
      );

      // Ignore stale response
      if (requestId !== ordersRequestRef.current) {
        return;
      }

      setOrders(result);
      setCurrentPage(1);
    } catch (e: any) {
      // Ignore stale response errors
      if (requestId !== ordersRequestRef.current) {
        return;
      }

      setError(
        e?.message ?? 'Could not load order history'
      );
    } finally {
      if (requestId === ordersRequestRef.current) {
        isLoadingOrdersRef.current = false;
        setLoadO(false);
      }
    }
  }, [branches, branchId, hours]);

  useEffect(() => {
    if (branches.length === 0) return;

    load();
  }, [branches.length, branchId, hours]);

  const filteredOrders = orders
    .filter(
      (o) =>
        filter === 'all' ||
        derivedStatus(o) === filter
    )
    .filter(
      (o) =>
        typeFilter === 'all' ||
        orderTypeOf(o) === typeFilter
    )
    .filter((o) => {
      if (!query.trim()) return true;

      const q = query.toLowerCase();

      return (
        o.orderId.toLowerCase().includes(q) ||
        (o.tableId ?? '')
          .toLowerCase()
          .includes(q) ||
        (o.deliveryAddress ?? '')
          .toLowerCase()
          .includes(q) ||
        o.branchName.toLowerCase().includes(q) ||
        (o.lineItems ?? []).some((li) =>
          li.name.toLowerCase().includes(q)
        )
      );
    })
    .sort((a, b) =>
      (b.placedAt ?? '').localeCompare(
        a.placedAt ?? ''
      )
    );

  const totalPages = Math.ceil(
    filteredOrders.length / PAGE_SIZE
  );

  const startIndex =
    (currentPage - 1) * PAGE_SIZE;

  const endIndex = startIndex + PAGE_SIZE;

  const shown = filteredOrders.slice(
    startIndex,
    endIndex
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [
    filter,
    typeFilter,
    query,
    hours,
    branchId,
  ]);

  const currency =
    branches[0]?.currencyCode || 'PKR';

  const showBranch =
    branchId === '' && branches.length > 1;

  const clearFilters = () => {
    setFilter('all');
    setTypeFilter('all');
    setQuery('');
    setCurrentPage(1);
  };

  const hasActiveFilters =
    filter !== 'all' ||
    typeFilter !== 'all' ||
    query.trim() !== '';

  const getBranchName = (id: string) => {
    if (
      !id ||
      !branches ||
      branches.length === 0
    ) {
      return '';
    }

    const branch = branches.find((b) => {
      const branchObj = b as any;

      return (
        branchObj._id === id ||
        branchObj.id === id ||
        branchObj.branchId === id ||
        branchObj.branch_id === id ||
        branchObj.restaurantId === id ||
        branchObj.companyId === id
      );
    });

    return branch?.name || '';
  };

  const truncate = (
    text: string,
    maxLength: number = 25
  ) => {
    if (!text) return '';

    return text.length > maxLength
      ? text.substring(0, maxLength) + '…'
      : text;
  };

  const formatPlacedDate = (
    placedAt: string | undefined
  ) => {
    if (!placedAt) {
      return {
        date: '—',
        time: '—',
      };
    }

    const date = new Date(placedAt);

    return {
      date: date.toLocaleDateString(
        'en-US',
        {
          month: 'short',
          day: 'numeric',
        }
      ),
      time: date.toLocaleTimeString(
        'en-US',
        {
          hour: '2-digit',
          minute: '2-digit',
        }
      ),
    };
  };

  // ── Print single order ──
  const handlePrintOrder = (
    order: BranchOrder
  ) => {
    setPrintingOrderId(order.orderId);

    setTimeout(() => {
      const status = derivedStatus(order);
      const itemsTotal = getItemsTotal(order);
      const addOnsTotal = getAddOnsTotal(order);
      const grandTotal = getGrandTotal(order);

      const printWindow = window.open(
        '',
        '_blank',
        'width=700,height=600'
      );

      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>
                Order #${order.orderId
            .slice(0, 8)
            .toUpperCase()}
              </title>

              <style>
                body {
                  font-family: Arial, sans-serif;
                  padding: 40px;
                  max-width: 600px;
                  margin: 0 auto;
                }

                h1 {
                  font-size: 24px;
                  margin-bottom: 4px;
                }

                .order-id {
                  color: #6B7280;
                  font-size: 14px;
                  margin-bottom: 20px;
                }

                .divider {
                  border-top: 2px solid #E5E7EB;
                  margin: 16px 0;
                }

                .row {
                  display: flex;
                  justify-content: space-between;
                  padding: 6px 0;
                }

                .label {
                  color: #6B7280;
                  font-weight: 600;
                }

                .total {
                  font-size: 18px;
                  font-weight: 800;
                  margin-top: 12px;
                }

                .status {
                  display: inline-block;
                  padding: 4px 12px;
                  border-radius: 4px;
                  font-weight: 600;
                  font-size: 12px;
                }

                .items {
                  margin: 12px 0;
                }

                .item {
                  display: flex;
                  justify-content: space-between;
                  padding: 4px 0;
                  border-bottom: 1px solid #F3F4F6;
                }

                .header {
                  text-align: center;
                  margin-bottom: 20px;
                }

                .header h1 {
                  margin: 0;
                }

                .header p {
                  margin: 4px 0 0;
                  color: #6B7280;
                  font-size: 13px;
                }

                .addon {
                  font-size: 11px;
                  color: #6B7280;
                  padding-left: 20px;
                }

                .price-breakdown {
                  background: #F9FAFB;
                  padding: 12px 16px;
                  border-radius: 8px;
                  margin-top: 8px;
                }
              </style>
            </head>

            <body>
              <div class="header">
                <h1>Order Receipt</h1>
                <p>#${order.orderId.toUpperCase()}</p>
              </div>

              <div class="divider"></div>

              <div class="row">
                <span class="label">Table</span>
                <span>${order.tableId || '—'}</span>
              </div>

              <div class="row">
                <span class="label">Type</span>
                <span>
                  ${ORDER_TYPE_LABEL[orderTypeOf(order)]}
                </span>
              </div>

              <div class="row">
                <span class="label">Destination</span>
                <span>${destinationOf(order)}</span>
              </div>

              <div class="row">
                <span class="label">Branch</span>
                <span>${order.branchName || '—'}</span>
              </div>

              <div class="row">
                <span class="label">Placed</span>
                <span>
                  ${order.placedAt
            ? new Date(
              order.placedAt
            ).toLocaleString()
            : '—'
          }
                </span>
              </div>

              <div class="divider"></div>

              <div class="items">
                <div
                  style="font-weight:700;margin-bottom:8px;"
                >
                  Items
                </div>

                ${(order.lineItems ?? [])
            .map((li) => {
              const addOns =
                getLineAddOns(li);

              return `
                      <div class="item">
                        <span>
                          ${li.quantity}× ${li.name}
                        </span>

                        <span>
                          ${money(
                (li.unitPriceMinorUnits ||
                  0) *
                li.quantity,
                order.currency
              )}
                        </span>
                      </div>

                      ${addOns
                  .map(
                    (a) => `
                            <div class="addon">
                              + ${a.name}
                              ×${a.quantity || 1}
                              →
                              ${money(
                      (a.priceMinorUnits ||
                        0) *
                      (a.quantity || 1),
                      order.currency
                    )}
                            </div>
                          `
                  )
                  .join('')}
                    `;
            })
            .join('')}
              </div>

              <div class="divider"></div>

              <div class="price-breakdown">
                <div class="row">
                  <span>Items Total</span>
                  <span>
                    ${money(
              itemsTotal,
              order.currency
            )}
                  </span>
                </div>

                <div class="row">
                  <span style="color:#ff5723;">
                    Add-Ons Total
                  </span>

                  <span style="color:#ff5723;">
                    ${money(
              addOnsTotal,
              order.currency
            )}
                  </span>
                </div>

                <div class="divider"></div>

                <div class="total">
                  <div class="row">
                    <span>Grand Total</span>

                    <span>
                      ${money(
              grandTotal,
              order.currency
            )}
                    </span>
                  </div>
                </div>
              </div>

              <div class="divider"></div>

              <div style="text-align:center;">
                <span
                  class="status"
                  style="
                    background:${STATUS_COLOR[status]}15;
                    color:${STATUS_COLOR[status]};
                  "
                >
                  ${STATUS_LABEL[status]}
                </span>
              </div>
            </body>
          </html>
        `);

        printWindow.document.close();
        printWindow.focus();

        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 500);
      }

      setPrintingOrderId(null);
    }, 300);
  };

  // ── Print all ──
  const handlePrintAll = () => {
    if (filteredOrders.length === 0) return;

    setPrintingAll(true);

    setTimeout(() => {
      const printWindow = window.open(
        '',
        '_blank',
        'width=1100,height=800'
      );

      if (printWindow) {
        const branchName =
          getBranchName(branchId);

        const filterLabel =
          filter !== 'all'
            ? ` · Status: ${STATUS_LABEL[filter]}`
            : '';

        const branchText = branchName
          ? ` · Branch: ${branchName}`
          : '';

        const totalItemsRevenue =
          filteredOrders.reduce(
            (sum, o) =>
              sum + getItemsTotal(o),
            0
          );

        const totalAddOnsRevenue =
          filteredOrders.reduce(
            (sum, o) =>
              sum + getAddOnsTotal(o),
            0
          );

        const totalGrandRevenue =
          filteredOrders.reduce(
            (sum, o) =>
              sum + getGrandTotal(o),
            0
          );

        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Order History Report</title>

              <style>
                body {
                  font-family: Arial, sans-serif;
                  padding: 30px;
                  max-width: 1200px;
                  margin: 0 auto;
                }

                h1 {
                  font-size: 24px;
                  margin-bottom: 4px;
                }

                .subtitle {
                  color: #6B7280;
                  font-size: 13px;
                  margin-bottom: 20px;
                }

                .header {
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  border-bottom: 2px solid #E5E7EB;
                  padding-bottom: 16px;
                  margin-bottom: 20px;
                }

                table {
                  width: 100%;
                  border-collapse: collapse;
                  font-size: 13px;
                }

                th {
                  padding: 10px 12px;
                  text-align: left;
                  font-weight: 700;
                  border-bottom: 2px solid #E5E7EB;
                  background: #F9FAFB;
                }

                td {
                  padding: 10px 12px;
                  border-bottom: 1px solid #E5E7EB;
                }

                tr:nth-child(even) {
                  background: #FAFAFA;
                }

                .status-badge {
                  display: inline-block;
                  padding: 2px 8px;
                  border-radius: 4px;
                  font-weight: 600;
                  font-size: 11px;
                }

                .total-row {
                  border-top: 2px solid #E5E7EB;
                  background: #F9FAFB;
                  font-weight: 700;
                }

                .footer {
                  margin-top: 20px;
                  text-align: center;
                  color: #6B7280;
                  font-size: 12px;
                  border-top: 1px solid #E5E7EB;
                  padding-top: 16px;
                }
              </style>
            </head>

            <body>
              <div class="header">
                <div>
                  <h1>Order History Report</h1>

                  <p class="subtitle">
                    Generated:
                    ${new Date().toLocaleString()}
                  </p>

                  <p
                    style="
                      font-size:12px;
                      color:#6B7280;
                      margin:2px 0 0;
                    "
                  >
                    ${RANGES.find(
          (r) => r.hours === hours
        )?.label || 'Custom'
          }

                    ${branchText}

                    ${filterLabel}
                  </p>
                </div>

                <div style="text-align:right;">
                  <p
                    style="
                      font-size:16px;
                      font-weight:700;
                      margin:0;
                    "
                  >
                    Total Orders:
                    ${filteredOrders.length}
                  </p>

                  <div
                    style="
                      background:#F9FAFB;
                      padding:12px 16px;
                      border-radius:8px;
                      margin-top:8px;
                      text-align:left;
                    "
                  >
                    <div
                      style="
                        display:flex;
                        justify-content:space-between;
                        font-size:13px;
                      "
                    >
                      <span>Items Revenue</span>

                      <span>
                        ${money(
            totalItemsRevenue,
            currency
          )}
                      </span>
                    </div>

                    <div
                      style="
                        display:flex;
                        justify-content:space-between;
                        font-size:13px;
                        color:#ff5723;
                      "
                    >
                      <span>Add-Ons Revenue</span>

                      <span>
                        ${money(
            totalAddOnsRevenue,
            currency
          )}
                      </span>
                    </div>

                    <div
                      style="
                        border-top:1px solid #E5E7EB;
                        margin:6px 0;
                        padding-top:6px;
                        display:flex;
                        justify-content:space-between;
                        font-size:15px;
                        font-weight:700;
                      "
                    >
                      <span>Total Revenue</span>

                      <span>
                        ${money(
            totalGrandRevenue,
            currency
          )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Placed</th>

                    ${showBranch
            ? '<th>Branch</th>'
            : ''
          }

                    <th>Type</th>
                    <th>Items</th>
                    <th>Add-Ons</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  ${filteredOrders
            .map((o) => {
              const s =
                derivedStatus(o);

              const itemsTotal =
                getItemsTotal(o);

              const addOnsTotal =
                getAddOnsTotal(o);

              const grandTotal =
                getGrandTotal(o);

              const itemNames =
                getItemNames(o);

              const addOnDetails =
                getAddOnDetails(o);

              const placed =
                formatPlacedDate(
                  o.placedAt
                );

              return `
                        <tr>
                          <td
                            style="
                              font-family:monospace;
                              font-size:12px;
                            "
                          >
                            #${o.orderId
                  .slice(0, 8)
                  .toUpperCase()}
                          </td>

                          <td
                            style="
                              font-size:11px;
                              line-height:1.4;
                            "
                          >
                            <div>
                              ${placed.date}
                            </div>

                            <div
                              style="
                                color:#6B7280;
                                font-size:10px;
                              "
                            >
                              ${placed.time}
                            </div>
                          </td>

                          ${showBranch
                  ? `
                                <td>
                                  ${o.branchName ||
                  '—'
                  }
                                </td>
                              `
                  : ''
                }

                          <td>
                            <span
                              style="
                                padding:2px 8px;
                                border-radius:4px;
                                font-weight:600;
                                font-size:11px;
                                background:
                                  ${ORDER_TYPE_COLOR[
                orderTypeOf(o)
                ]
                }15;
                                color:
                                  ${ORDER_TYPE_COLOR[
                orderTypeOf(o)
                ]
                };
                              "
                            >
                              ${ORDER_TYPE_LABEL[
                orderTypeOf(o)
                ]
                }
                            </span>
                          </td>

                          <td
                            style="
                              max-width:150px;
                              font-size:12px;
                            "
                          >
                            <div
                              style="
                                white-space:nowrap;
                                overflow:hidden;
                                text-overflow:ellipsis;
                              "
                              title="${itemNames}"
                            >
                              ${truncate(
                  itemNames,
                  20
                )}
                            </div>
                          </td>

                          <td
                            style="
                              max-width:150px;
                              font-size:11px;
                              color:#ff5723;
                            "
                          >
                            <div
                              style="
                                white-space:nowrap;
                                overflow:hidden;
                                text-overflow:ellipsis;
                              "
                              title="${addOnDetails}"
                            >
                              ${truncate(
                  addOnDetails,
                  20
                )}
                            </div>
                          </td>

                          <td
                            style="
                              text-align:right;
                              font-weight:700;
                            "
                          >
                            ${money(
                  grandTotal,
                  o.currency
                )}
                          </td>

                          <td>
                            <span
                              class="status-badge"
                              style="
                                background:
                                  ${STATUS_COLOR[s]}15;
                                color:
                                  ${STATUS_COLOR[s]};
                              "
                            >
                              ${STATUS_LABEL[s]}
                            </span>
                          </td>
                        </tr>
                      `;
            })
            .join('')}
                </tbody>

                <tfoot>
                  <tr class="total-row">
                    <td
                      colspan="${showBranch ? 4 : 3
          }"
                    >
                      Total Orders:
                      ${filteredOrders.length}
                    </td>

                    <td></td>

                    <td
                      style="
                        color:#ff5723;
                        font-weight:700;
                      "
                    >
                      ${money(
            filteredOrders.reduce(
              (sum, o) =>
                sum +
                getAddOnsTotal(o),
              0
            ),
            currency
          )}
                    </td>

                    <td
                      style="
                        text-align:right;
                        font-weight:800;
                      "
                    >
                      ${money(
            filteredOrders.reduce(
              (sum, o) =>
                sum +
                getGrandTotal(o),
              0
            ),
            currency
          )}
                    </td>

                    <td></td>
                  </tr>
                </tfoot>
              </table>

              <div class="footer">
                © ${new Date().getFullYear()}
                Menulay — Order History Report
              </div>
            </body>
          </html>
        `);

        printWindow.document.close();
        printWindow.focus();

        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 500);
      }

      setPrintingAll(false);
    }, 300);
  };

  const goToPage = (page: number) => {
    if (
      page < 1 ||
      page > totalPages
    ) {
      return;
    }

    setCurrentPage(page);
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  return (
    <div
      style={{
        background: colors.bg,
        padding: '16px 20px 40px',
        maxWidth: 1150,
        margin: '0 auto',
        minHeight: '100vh',
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      <style>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .print-btn {
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 6px;
          transition: all 0.2s;
          color: ${colors.muted};
        }

        .print-btn:hover {
          background: ${colors.card2};
          color: ${BRAND};
        }

        .print-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <h1
              style={{
                fontSize:
                  'clamp(20px, 3vw, 26px)',
                fontWeight: 800,
                color: colors.text,
                margin: '0 0 2px',
              }}
            >
              Order History
            </h1>

            <p
              style={{
                color: colors.muted,
                fontSize: 13,
                margin: 0,
              }}
            >
              Everything your restaurants
              have served recently.
            </p>
          </div>

          <button
            onClick={load}
            disabled={loadingO}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              border:
                `1.5px solid ${colors.border}`,
              borderRadius: 10,
              background: colors.card2,
              fontWeight: 600,
              fontSize: 13,
              cursor: loadingO
                ? 'not-allowed'
                : 'pointer',
              color: colors.text,
              opacity: loadingO ? 0.7 : 1,
              fontFamily:
                "'Poppins', sans-serif",
            }}
          >
            <RefreshCw
              size={14}
              style={
                loadingO
                  ? {
                    animation:
                      'spin 1s linear infinite',
                  }
                  : undefined
              }
            />

            Refresh
          </button>
        </div>
      </div>

      {/* Branch Picker */}
      <BranchPicker
        branches={branches}
        value={branchId}
        onChange={setBranchId}
        loading={loadingB}
      />

      {!loadingB && branches.length > 0 && (
        <>
          {/* Filters */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              marginBottom: 16,
            }}
          >
            {/* Time + Clear */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
                alignItems: 'center',
              }}
            >
              <select
                value={hours}
                onChange={(e) =>
                  setHours(
                    Number(e.target.value)
                  )
                }
                style={{
                  padding: '7px 12px',
                  border:
                    `1.5px solid ${colors.border}`,
                  borderRadius: 10,
                  fontSize: 13,
                  fontFamily:
                    "'Poppins', sans-serif",
                  fontWeight: 500,
                  background: colors.card2,
                  color: colors.text,
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                {RANGES.map((r) => (
                  <option
                    key={r.hours}
                    value={r.hours}
                  >
                    {r.label}
                  </option>
                ))}
              </select>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '6px 14px',
                    borderRadius: 20,
                    border:
                      `1.5px solid ${colors.border}`,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: colors.card2,
                    color: colors.muted,
                    fontFamily:
                      "'Poppins', sans-serif",
                  }}
                >
                  <X size={14} />
                  Clear filters
                </button>
              )}
            </div>

            {/* Status */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 6,
              }}
            >
              {FILTERS.map((f) => {
                const active = filter === f;

                return (
                  <button
                    key={f}
                    onClick={() =>
                      setFilter(f)
                    }
                    style={{
                      padding: '6px 14px',
                      borderRadius: 20,
                      border:
                        `1.5px solid ${active
                          ? BRAND
                          : colors.border
                        }`,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: active
                        ? BRAND
                        : colors.card2,
                      color: active
                        ? '#fff'
                        : colors.muted,
                      fontFamily:
                        "'Poppins', sans-serif",
                    }}
                  >
                    {f === 'all'
                      ? 'All'
                      : STATUS_LABEL[f]}
                  </button>
                );
              })}
            </div>

            {/* Type + Search */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                }}
              >
                {(
                  [
                    'all',
                    'dine_in',
                    'pickup',
                    'delivery',
                  ] as const
                ).map((t) => {
                  const active =
                    typeFilter === t;

                  return (
                    <button
                      key={t}
                      onClick={() =>
                        setTypeFilter(t)
                      }
                      style={{
                        padding: '6px 14px',
                        borderRadius: 20,
                        border:
                          `1.5px solid ${active
                            ? colors.text
                            : colors.border
                          }`,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: active
                          ? colors.text
                          : colors.card2,
                        color: active
                          ? isDark
                            ? '#111111'
                            : '#FFFFFF'
                          : colors.muted,
                        fontFamily:
                          "'Poppins', sans-serif",
                      }}
                    >
                      {t === 'all'
                        ? 'Any type'
                        : ORDER_TYPE_LABEL[t]}
                    </button>
                  );
                })}
              </div>

              <div
                style={{
                  position: 'relative',
                  flex: 1,
                  minWidth: 180,
                }}
              >
                <Search
                  size={14}
                  color={colors.subtle}
                  style={{
                    position: 'absolute',
                    left: 10,
                    top: '50%',
                    transform:
                      'translateY(-50%)',
                  }}
                />

                <input
                  value={query}
                  onChange={(e) =>
                    setQuery(e.target.value)
                  }
                  placeholder="Search orders, items, tables..."
                  style={{
                    width: '100%',
                    padding:
                      '8px 11px 8px 30px',
                    border:
                      `1.5px solid ${colors.border}`,
                    borderRadius: 10,
                    fontSize: 13,
                    fontFamily:
                      "'Poppins', sans-serif",
                    boxSizing: 'border-box',
                    background: colors.card2,
                    color: colors.text,
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Loading */}
          {loadingO && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 20px',
                color: colors.muted,
              }}
            >
              <Loader2
                size={22}
                style={{
                  animation:
                    'spin 1s linear infinite',
                }}
              />

              <p
                style={{
                  marginTop: 12,
                  fontSize: 14,
                }}
              >
                Loading orders…
              </p>
            </div>
          )}

          {/* Error */}
          {!loadingO && error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '40px 20px',
                color: BRAND,
              }}
            >
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          {/* Content */}
          {!loadingO && !error && (
            <>
              {/* Stats */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(120px, 1fr))',
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <Stat
                  label="Orders"
                  value={String(
                    filteredOrders.length
                  )}
                  colors={colors}
                />

                <Stat
                  label="Items Revenue"
                  value={money(
                    filteredOrders.reduce(
                      (sum, o) =>
                        sum +
                        getItemsTotal(o),
                      0
                    ),
                    currency
                  )}
                  colors={colors}
                />

                <Stat
                  label="Add-Ons Revenue"
                  value={money(
                    filteredOrders.reduce(
                      (sum, o) =>
                        sum +
                        getAddOnsTotal(o),
                      0
                    ),
                    currency
                  )}
                  accent={BRAND}
                  colors={colors}
                />

                <Stat
                  label="Total Revenue"
                  value={money(
                    filteredOrders.reduce(
                      (sum, o) =>
                        sum +
                        getGrandTotal(o),
                      0
                    ),
                    currency
                  )}
                  accent={colors.text}
                  colors={colors}
                />
              </div>

              {/* Empty */}
              {filteredOrders.length === 0 ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '60px 20px',
                    color: colors.subtle,
                  }}
                >
                  <Receipt
                    size={28}
                    style={{
                      opacity: 0.4,
                      marginBottom: 8,
                    }}
                  />

                  <p
                    style={{
                      margin: 0,
                      fontWeight: 600,
                      color: colors.muted,
                    }}
                  >
                    Nothing here
                  </p>

                  <p
                    style={{
                      margin:
                        '4px 0 0',
                      fontSize: 13,
                      color:
                        colors.subtle,
                    }}
                  >
                    {query ||
                      filter !== 'all' ||
                      typeFilter !== 'all'
                      ? 'No orders match those filters.'
                      : 'No orders in this time window.'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Table */}
                  <div
                    style={{
                      border:
                        `1px solid ${colors.border}`,
                      borderRadius: 12,
                      overflow: 'hidden',
                      background:
                        colors.card,
                    }}
                  >
                    <div
                      style={{
                        overflowX: 'auto',
                        WebkitOverflowScrolling:
                          'touch',
                      }}
                    >
                      <table
                        style={{
                          width: '100%',
                          borderCollapse:
                            'collapse',
                          minWidth: 750,
                        }}
                      >
                        <thead
                          style={{
                            background:
                              colors.card2,
                          }}
                        >
                          <tr>
                            {[
                              'Placed',
                              ...(showBranch
                                ? ['Restaurant']
                                : []),
                              'Type',
                              'Items',
                              'Add-Ons',
                              'Total',
                              'Status',
                              'Print',
                            ].map((header) => (
                              <th
                                key={header}
                                style={{
                                  padding:
                                    '10px 12px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  letterSpacing: 1,
                                  textTransform:
                                    'uppercase',
                                  color:
                                    colors.subtle,
                                  textAlign:
                                    header ===
                                      'Print'
                                      ? 'center'
                                      : header ===
                                        'Total'
                                        ? 'right'
                                        : 'left',
                                  whiteSpace:
                                    'nowrap',
                                }}
                              >
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>

                        <tbody>
                          {shown.map((o) => {
                            const s =
                              derivedStatus(o);

                            const n =
                              (
                                o.lineItems ??
                                []
                              ).reduce(
                                (x, li) =>
                                  x +
                                  li.quantity,
                                0
                              );

                            const isPrinting =
                              printingOrderId ===
                              o.orderId;

                            const itemsTotal =
                              getItemsTotal(o);

                            const addOnsTotal =
                              getAddOnsTotal(o);

                            const grandTotal =
                              getGrandTotal(o);

                            const itemNames =
                              getItemNames(o);

                            const addOnDetails =
                              getAddOnDetails(o);

                            const placed =
                              formatPlacedDate(
                                o.placedAt
                              );

                            return (
                              <tr
                                key={
                                  o.orderId
                                }
                                style={{
                                  borderTop:
                                    `1px solid ${colors.border}`,
                                }}
                              >
                                <td
                                  style={{
                                    padding:
                                      '11px 12px',
                                    fontSize: 12,
                                    color:
                                      colors.text,
                                    whiteSpace:
                                      'nowrap',
                                  }}
                                >
                                  <div>
                                    {
                                      placed.date
                                    }
                                  </div>

                                  <div
                                    style={{
                                      color:
                                        colors.subtle,
                                      fontSize: 10,
                                    }}
                                  >
                                    {
                                      placed.time
                                    }
                                  </div>
                                </td>

                                {showBranch && (
                                  <td
                                    style={{
                                      padding:
                                        '11px 12px',
                                      fontSize: 14,
                                      color:
                                        colors.muted,
                                      whiteSpace:
                                        'nowrap',
                                      maxWidth:
                                        120,
                                      overflow:
                                        'hidden',
                                      textOverflow:
                                        'ellipsis',
                                    }}
                                  >
                                    {truncate(
                                      o.branchName,
                                      15
                                    )}
                                  </td>
                                )}

                                <td
                                  style={{
                                    padding:
                                      '11px 12px',
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 700,
                                      textTransform:
                                        'uppercase',
                                      letterSpacing:
                                        0.4,
                                      padding:
                                        '3px 8px',
                                      borderRadius: 6,
                                      background:
                                        isDark
                                          ? `${ORDER_TYPE_COLOR[
                                          orderTypeOf(
                                            o
                                          )
                                          ]}15`
                                          : `${ORDER_TYPE_COLOR[
                                          orderTypeOf(
                                            o
                                          )
                                          ]}10`,
                                      color:
                                        ORDER_TYPE_COLOR[
                                        orderTypeOf(
                                          o
                                        )
                                        ],
                                      whiteSpace:
                                        'nowrap',
                                    }}
                                  >
                                    {
                                      ORDER_TYPE_LABEL[
                                      orderTypeOf(
                                        o
                                      )
                                      ]
                                    }
                                  </span>
                                </td>

                                <td
                                  style={{
                                    padding:
                                      '11px 12px',
                                    fontSize: 12,
                                    color:
                                      colors.text,
                                    maxWidth:
                                      150,
                                  }}
                                >
                                  <div
                                    style={{
                                      whiteSpace:
                                        'nowrap',
                                      overflow:
                                        'hidden',
                                      textOverflow:
                                        'ellipsis',
                                    }}
                                    title={
                                      itemNames
                                    }
                                  >
                                    {truncate(
                                      itemNames,
                                      25
                                    )}
                                  </div>

                                  <div
                                    style={{
                                      color:
                                        colors.subtle,
                                      fontSize: 10,
                                    }}
                                  >
                                    {n} item
                                    {n === 1
                                      ? ''
                                      : 's'}{' '}
                                    ·{' '}
                                    {money(
                                      itemsTotal,
                                      o.currency
                                    )}
                                  </div>
                                </td>

                                <td
                                  style={{
                                    padding:
                                      '11px 12px',
                                    fontSize: 11,
                                    color:
                                      colors.text,
                                    maxWidth:
                                      150,
                                  }}
                                >
                                  {addOnsTotal >
                                    0 ? (
                                    <>
                                      <div
                                        style={{
                                          whiteSpace:
                                            'nowrap',
                                          overflow:
                                            'hidden',
                                          textOverflow:
                                            'ellipsis',
                                        }}
                                        title={
                                          addOnDetails
                                        }
                                      >
                                        {truncate(
                                          addOnDetails,
                                          25
                                        )}
                                      </div>

                                      <div
                                        style={{
                                          color:
                                            colors.subtle,
                                          fontSize: 10,
                                          fontWeight: 700,
                                        }}
                                      >
                                        {money(
                                          addOnsTotal,
                                          o.currency
                                        )}
                                      </div>
                                    </>
                                  ) : (
                                    <span
                                      style={{
                                        color:
                                          colors.subtle,
                                      }}
                                    >
                                      —
                                    </span>
                                  )}
                                </td>

                                <td
                                  style={{
                                    padding:
                                      '11px 12px',
                                    fontSize: 14,
                                    fontWeight: 700,
                                    color:
                                      colors.text,
                                    textAlign:
                                      'right',
                                    whiteSpace:
                                      'nowrap',
                                  }}
                                >
                                  {money(
                                    grandTotal,
                                    o.currency
                                  )}
                                </td>

                                <td
                                  style={{
                                    padding:
                                      '11px 12px',
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 700,
                                      textTransform:
                                        'uppercase',
                                      letterSpacing:
                                        0.5,
                                      padding:
                                        '3px 8px',
                                      borderRadius: 6,
                                      background:
                                        isDark
                                          ? `${STATUS_COLOR[s]}15`
                                          : `${STATUS_COLOR[s]}10`,
                                      color:
                                        STATUS_COLOR[
                                        s
                                        ],
                                      whiteSpace:
                                        'nowrap',
                                    }}
                                  >
                                    {
                                      STATUS_LABEL[
                                      s
                                      ]
                                    }
                                  </span>
                                </td>

                                <td
                                  style={{
                                    padding:
                                      '11px 12px',
                                    textAlign:
                                      'center',
                                  }}
                                >
                                  <button
                                    onClick={() =>
                                      handlePrintOrder(
                                        o
                                      )
                                    }
                                    disabled={
                                      isPrinting
                                    }
                                    className="print-btn"
                                    title="Print this order"
                                  >
                                    {isPrinting ? (
                                      <Loader2
                                        size={16}
                                        style={{
                                          animation:
                                            'spin 1s linear infinite',
                                        }}
                                      />
                                    ) : (
                                      <Printer
                                        size={16}
                                      />
                                    )}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>

                        <tfoot
                          style={{
                            background:
                              colors.card2,
                            borderTop:
                              `2px solid ${colors.border}`,
                          }}
                        >
                          <tr>
                            <td
                              colSpan={
                                showBranch
                                  ? 3
                                  : 2
                              }
                              style={{
                                padding:
                                  '12px 16px',
                                fontWeight: 700,
                                color:
                                  colors.text,
                              }}
                            >
                              Total Orders:{' '}
                              {
                                filteredOrders.length
                              }
                            </td>

                            <td
                              style={{
                                padding:
                                  '12px 16px',
                                fontWeight: 700,
                                color:
                                  colors.muted,
                              }}
                            >
                              {money(
                                filteredOrders.reduce(
                                  (sum, o) =>
                                    sum +
                                    getItemsTotal(
                                      o
                                    ),
                                  0
                                ),
                                currency
                              )}
                            </td>

                            <td
                              style={{
                                padding:
                                  '12px 16px',
                                fontWeight: 700,
                                color: BRAND,
                              }}
                            >
                              {money(
                                filteredOrders.reduce(
                                  (sum, o) =>
                                    sum +
                                    getAddOnsTotal(
                                      o
                                    ),
                                  0
                                ),
                                currency
                              )}
                            </td>

                            <td
                              style={{
                                padding:
                                  '12px 16px',
                                fontWeight: 800,
                                color:
                                  colors.text,
                                textAlign:
                                  'right',
                              }}
                            >
                              {money(
                                filteredOrders.reduce(
                                  (sum, o) =>
                                    sum +
                                    getGrandTotal(
                                      o
                                    ),
                                  0
                                ),
                                currency
                              )}
                            </td>

                            <td
                              colSpan={2}
                            />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems:
                          'center',
                        justifyContent:
                          'space-between',
                        padding:
                          '12px 4px',
                        marginTop: 12,
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          color:
                            colors.subtle,
                        }}
                      >
                        Showing{' '}
                        {startIndex + 1}–
                        {Math.min(
                          endIndex,
                          filteredOrders.length
                        )}{' '}
                        of{' '}
                        {
                          filteredOrders.length
                        }{' '}
                        orders
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems:
                            'center',
                          gap: 6,
                        }}
                      >
                        <button
                          onClick={
                            goToPreviousPage
                          }
                          disabled={
                            currentPage ===
                            1
                          }
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            border:
                              `1.5px solid ${colors.border}`,
                            background:
                              colors.card,
                            color:
                              colors.text,
                            cursor:
                              currentPage ===
                                1
                                ? 'not-allowed'
                                : 'pointer',
                            opacity:
                              currentPage ===
                                1
                                ? 0.5
                                : 1,
                          }}
                        >
                          <ChevronLeft
                            size={18}
                          />
                        </button>

                        <div
                          style={{
                            display: 'flex',
                            alignItems:
                              'center',
                            gap: 4,
                          }}
                        >
                          {Array.from(
                            {
                              length:
                                Math.min(
                                  totalPages,
                                  7
                                ),
                            },
                            (_, i) => {
                              let pageNum;

                              if (
                                totalPages <=
                                7
                              ) {
                                pageNum =
                                  i + 1;
                              } else if (
                                currentPage <=
                                4
                              ) {
                                pageNum =
                                  i + 1;

                                if (
                                  i === 6
                                ) {
                                  pageNum =
                                    totalPages;
                                }
                              } else if (
                                currentPage >=
                                totalPages -
                                3
                              ) {
                                pageNum =
                                  totalPages -
                                  6 +
                                  i;
                              } else {
                                pageNum =
                                  currentPage -
                                  3 +
                                  i;
                              }

                              const isActive =
                                pageNum ===
                                currentPage;

                              const isEllipsis =
                                i === 3 &&
                                totalPages >
                                7 &&
                                currentPage >
                                4 &&
                                currentPage <
                                totalPages -
                                3;

                              if (
                                isEllipsis
                              ) {
                                return (
                                  <span
                                    key={`ellipsis-${i}`}
                                    style={{
                                      padding:
                                        '0 4px',
                                      color:
                                        colors.subtle,
                                    }}
                                  >
                                    …
                                  </span>
                                );
                              }

                              return (
                                <button
                                  key={
                                    pageNum
                                  }
                                  onClick={() =>
                                    goToPage(
                                      pageNum
                                    )
                                  }
                                  style={{
                                    minWidth: 36,
                                    height: 36,
                                    padding:
                                      '0 8px',
                                    borderRadius:
                                      8,
                                    border:
                                      `1.5px solid ${isActive
                                        ? BRAND
                                        : colors.border
                                      }`,
                                    background:
                                      isActive
                                        ? BRAND
                                        : colors.card,
                                    color:
                                      isActive
                                        ? '#fff'
                                        : colors.text,
                                    fontWeight:
                                      isActive
                                        ? 700
                                        : 500,
                                    fontSize: 13,
                                    cursor:
                                      'pointer',
                                  }}
                                >
                                  {
                                    pageNum
                                  }
                                </button>
                              );
                            }
                          )}
                        </div>

                        <button
                          onClick={
                            goToNextPage
                          }
                          disabled={
                            currentPage ===
                            totalPages
                          }
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            border:
                              `1.5px solid ${colors.border}`,
                            background:
                              colors.card,
                            color:
                              colors.text,
                            cursor:
                              currentPage ===
                                totalPages
                                ? 'not-allowed'
                                : 'pointer',
                            opacity:
                              currentPage ===
                                totalPages
                                ? 0.5
                                : 1,
                          }}
                        >
                          <ChevronRight
                            size={18}
                          />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  colors,
}: {
  label: string;
  value: string;
  accent?: string;
  colors: ReturnType<typeof getColors>;
}) {
  return (
    <div
      style={{
        background: colors.card,
        border:
          `1px solid ${colors.border}`,
        borderRadius: 12,
        padding: '10px 18px',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 1,
          textTransform: 'uppercase',
          color: colors.subtle,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize:
            'clamp(18px, 2.5vw, 20px)',
          fontWeight: 800,
          color:
            accent ?? colors.text,
        }}
      >
        {value}
      </div>
    </div>
  );
}