<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { api, toAbsoluteImageUrl } from '@/api/client';
import type { AuditLog, ConsumptionOrder, MemberLevel, MemberProfile, RechargeOrder } from '@member-platform/shared';

type Tab = 'members' | 'levels' | 'recharges' | 'orders' | 'logs';

const currentTab = ref<Tab>('members');
const loading = ref(false);
const error = ref('');

const members = ref<MemberProfile[]>([]);
const memberEditRows = ref<
  Record<
    string,
    {
      id: string;
      nickname: string;
      birthday: string;
      levelId: string;
      discountRate: number;
      balance: number;
      points: number;
    }
  >
>({});
const levels = ref<MemberLevel[]>([]);
const levelEditRows = ref<Record<string, { name: string; minPoints: number; discountRate: number }>>({});
const recharges = ref<RechargeOrder[]>([]);
const orders = ref<ConsumptionOrder[]>([]);
const logs = ref<AuditLog[]>([]);

const levelForm = ref({ name: '', minPoints: 0, discountRate: 1 });
const rejectReason = ref('资料不完整');

const showOrderModal = ref(false);
const showSubmitBubble = ref(false);
const uploadingImages = ref(false);
const memberKeyword = ref('');
const orderFilterUserId = ref('all');

const orderForm = ref({
  userId: '',
  productType: '',
  title: '门店消费',
  originalPrice: 100,
  discountRate: 1,
  effectImages: [] as string[],
  orderDate: new Date().toISOString().slice(0, 10),
  remark: '',
});

const productTypeOptions = ['护理', '理疗', '美体', '套餐', '其他'];

const matchedMembers = computed(() => {
  const keyword = memberKeyword.value.trim().toLowerCase();
  if (!keyword) return members.value;
  return members.value.filter((member) => {
    const hay = `${member.nickname} ${member.id} ${member.openId}`.toLowerCase();
    return hay.includes(keyword);
  });
});

const selectedMember = computed(() => members.value.find((item) => item.id === orderForm.value.userId));
const selectedLevel = computed(() =>
  selectedMember.value ? levels.value.find((level) => level.id === selectedMember.value?.levelId) : undefined,
);
const memberDiscountRate = computed(() => selectedMember.value?.discountRate ?? selectedLevel.value?.discountRate ?? 1);
const finalPrice = computed(() => Math.round(orderForm.value.originalPrice * orderForm.value.discountRate * 100) / 100);

const auditActionLabels: Record<string, string> = {
  'seed.init': '系统初始化',
  'auth.wechat.login': '会员微信登录',
  'recharge.apply': '提交充值申请',
  'recharge.approve': '通过充值申请',
  'recharge.reject': '拒绝充值申请',
  'member.update': '修改会员资料',
  'member.self.update': '会员自助修改资料',
  'consumption.create': '创建消费订单',
};

const auditFieldLabels: Record<string, string> = {
  originMemberId: '原会员 ID',
  openId: 'OpenID',
  userId: '会员 ID',
  phone: '手机号',
  productType: '产品类型',
  originalPrice: '原价',
  discountRate: '折扣率',
  finalPrice: '会员价',
  message: '说明',
  comment: '备注',
  reason: '原因',
  balance: '余额',
  points: '积分',
  nickname: '昵称',
  birthday: '生日',
  levelId: '等级 ID',
  levelName: '等级名称',
  id: '会员 ID',
  changes: '变更明细',
};

function getAuditActionLabel(action: string): string {
  return auditActionLabels[action] || action;
}

function formatAuditValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '-';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return String(value);
}

function formatAuditMetadata(metadata: AuditLog['metadata']): string[] {
  if (!metadata) return ['无详情'];

  const lines: string[] = [];

  for (const [key, value] of Object.entries(metadata)) {
    if (key === 'changes' && value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [field, detail] of Object.entries(value as Record<string, unknown>)) {
        const fieldLabel = auditFieldLabels[field] || field;
        if (detail && typeof detail === 'object' && 'from' in (detail as Record<string, unknown>) && 'to' in (detail as Record<string, unknown>)) {
          const change = detail as { from?: unknown; to?: unknown };
          lines.push(`${fieldLabel}：${formatAuditValue(change.from)} → ${formatAuditValue(change.to)}`);
        } else {
          lines.push(`${fieldLabel}：${formatAuditValue(detail)}`);
        }
      }
      continue;
    }

    if (value && typeof value === 'object' && 'from' in (value as Record<string, unknown>) && 'to' in (value as Record<string, unknown>)) {
      const change = value as { from?: unknown; to?: unknown };
      lines.push(`${auditFieldLabels[key] || key}：${formatAuditValue(change.from)} → ${formatAuditValue(change.to)}`);
      continue;
    }

    lines.push(`${auditFieldLabels[key] || key}：${formatAuditValue(value)}`);
  }

  return lines;
}

async function loadAll() {
  loading.value = true;
  error.value = '';
  try {
    const [memberList, levelList, rechargeList, orderList, auditList] = await Promise.all([
      api.listMembers(),
      api.listLevels(),
      api.listRecharges(),
      api.listConsumptionOrders(),
      api.listAuditLogs(),
    ]);

    members.value = memberList;
    memberEditRows.value = Object.fromEntries(
      memberList.map((item) => [
        item.id,
        {
          id: item.id,
          nickname: item.nickname,
          birthday: item.birthday || '',
          levelId: item.levelId,
          discountRate: item.discountRate,
          balance: item.balance,
          points: item.points,
        },
      ]),
    );

    levels.value = levelList;
    levelEditRows.value = Object.fromEntries(
      levelList.map((item) => [
        item.id,
        {
          name: item.name,
          minPoints: item.minPoints,
          discountRate: item.discountRate,
        },
      ]),
    );

    recharges.value = rechargeList;
    orders.value = orderList;
    logs.value = auditList;

    if (!orderForm.value.userId && memberList.length > 0) {
      orderForm.value.userId = memberList[0].id;
      orderForm.value.discountRate = memberList[0].discountRate;
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

async function saveMember(originId: string) {
  const row = memberEditRows.value[originId];
  if (!row) return;

  await api.updateMember(originId, {
    id: row.id.trim(),
    nickname: row.nickname.trim(),
    birthday: row.birthday || undefined,
    levelId: row.levelId,
    discountRate: Number(row.discountRate),
    balance: Number(row.balance),
    points: Number(row.points),
  });
  await loadAll();
}

async function createLevel() {
  await api.createLevel({
    name: levelForm.value.name.trim(),
    minPoints: Number(levelForm.value.minPoints),
    discountRate: Number(levelForm.value.discountRate),
  });
  levelForm.value = { name: '', minPoints: 0, discountRate: 1 };
  await loadAll();
}

async function saveLevel(levelId: string) {
  const row = levelEditRows.value[levelId];
  if (!row) return;
  await api.updateLevel(levelId, {
    name: row.name.trim(),
    minPoints: Number(row.minPoints),
    discountRate: Number(row.discountRate),
  });
  await loadAll();
}

async function approve(id: string) {
  await api.approveRecharge(id);
  await loadAll();
}

async function reject(id: string) {
  await api.rejectRecharge(id, { reason: rejectReason.value.trim() || '未提供原因' });
  await loadAll();
}

function openCreateOrderModal() {
  showOrderModal.value = true;
  showSubmitBubble.value = false;
  memberKeyword.value = '';
  orderForm.value.orderDate = new Date().toISOString().slice(0, 10);
  if (!orderForm.value.userId && members.value.length > 0) {
    orderForm.value.userId = members.value[0].id;
  }
  orderForm.value.discountRate = memberDiscountRate.value;
}

function closeCreateOrderModal() {
  showOrderModal.value = false;
  showSubmitBubble.value = false;
}

async function uploadEffectImages(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files || []);
  if (!files.length) return;

  uploadingImages.value = true;
  try {
    const urls = await api.uploadImages(files);
    orderForm.value.effectImages.push(...urls);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    uploadingImages.value = false;
    input.value = '';
  }
}

function removeImage(index: number) {
  orderForm.value.effectImages.splice(index, 1);
}

async function confirmCreateOrder() {
  await api.createConsumptionOrder({
    userId: orderForm.value.userId,
    productType: orderForm.value.productType || undefined,
    title: orderForm.value.title.trim(),
    originalPrice: Number(orderForm.value.originalPrice),
    discountRate: Number(orderForm.value.discountRate),
    effectImages: orderForm.value.effectImages,
    orderDate: orderForm.value.orderDate,
    remark: orderForm.value.remark || undefined,
  });

  closeCreateOrderModal();
  showSubmitBubble.value = false;
  await loadAll();
}

async function loadFilteredOrders() {
  if (orderFilterUserId.value === 'all') {
    orders.value = await api.listConsumptionOrders();
    return;
  }
  orders.value = await api.listMemberConsumptionOrders(orderFilterUserId.value);
}

watch(
  () => orderForm.value.userId,
  () => {
    orderForm.value.discountRate = memberDiscountRate.value;
  },
);

onMounted(loadAll);
</script>

<template>
  <div class="layout">
    <aside class="sidebar">
      <h1>会员后台 v1</h1>
      <button class="nav-item" :class="{ active: currentTab === 'members' }" @click="currentTab = 'members'">
        会员管理
      </button>
      <button class="nav-item" :class="{ active: currentTab === 'levels' }" @click="currentTab = 'levels'">
        等级管理
      </button>
      <button class="nav-item" :class="{ active: currentTab === 'recharges' }" @click="currentTab = 'recharges'">
        充值审核
      </button>
      <button class="nav-item" :class="{ active: currentTab === 'orders' }" @click="currentTab = 'orders'">
        消费订单
      </button>
      <button class="nav-item" :class="{ active: currentTab === 'logs' }" @click="currentTab = 'logs'">
        审计日志
      </button>
    </aside>

    <main class="main">
      <div class="card inline" style="justify-content: space-between">
        <div>
          <strong>演示管理员：</strong>admin-001
          <small style="margin-left: 12px">{{ loading ? '加载中...' : '已连接 API' }}</small>
        </div>
        <button class="primary" @click="loadAll">刷新数据</button>
      </div>

      <div v-if="error" class="card" style="border-color: #fecaca; color: #b42318">{{ error }}</div>

      <section v-if="currentTab === 'members'" class="card">
        <h2>会员列表</h2>
        <table>
          <thead>
            <tr>
              <th>会员 ID</th>
              <th>昵称</th>
              <th>生日</th>
              <th>等级</th>
              <th>折扣</th>
              <th>余额</th>
              <th>积分</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in members" :key="item.id">
              <td><input v-model="memberEditRows[item.id].id" /></td>
              <td><input v-model="memberEditRows[item.id].nickname" /></td>
              <td><input v-model="memberEditRows[item.id].birthday" type="date" /></td>
              <td>
                <select v-model="memberEditRows[item.id].levelId">
                  <option v-for="level in levels" :key="level.id" :value="level.id">
                    {{ level.name }}
                  </option>
                </select>
              </td>
              <td>
                <input
                  v-model.number="memberEditRows[item.id].discountRate"
                  type="number"
                  step="0.01"
                  min="0.1"
                  max="1"
                />
              </td>
              <td><input v-model.number="memberEditRows[item.id].balance" type="number" step="0.01" min="0" /></td>
              <td><input v-model.number="memberEditRows[item.id].points" type="number" step="1" min="0" /></td>
              <td><button class="primary" @click="saveMember(item.id)">保存</button></td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="currentTab === 'levels'" class="card">
        <h2>会员等级</h2>
        <div class="inline" style="margin-bottom: 12px">
          <input v-model="levelForm.name" placeholder="等级名称" />
          <input v-model.number="levelForm.minPoints" type="number" min="0" placeholder="最低积分" />
          <input
            v-model.number="levelForm.discountRate"
            type="number"
            step="0.01"
            min="0.1"
            max="1"
            placeholder="折扣"
          />
          <button class="primary" @click="createLevel">新增等级</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>名称</th>
              <th>最低积分</th>
              <th>折扣</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="level in levels" :key="level.id">
              <td>{{ level.id }}</td>
              <td><input v-model="levelEditRows[level.id].name" /></td>
              <td><input v-model.number="levelEditRows[level.id].minPoints" type="number" min="0" /></td>
              <td>
                <input
                  v-model.number="levelEditRows[level.id].discountRate"
                  type="number"
                  step="0.01"
                  min="0.1"
                  max="1"
                />
              </td>
              <td><button class="primary" @click="saveLevel(level.id)">保存</button></td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="currentTab === 'recharges'" class="card">
        <h2>充值审核</h2>
        <div class="inline" style="margin-bottom: 12px">
          <small>拒绝理由：</small>
          <input v-model="rejectReason" placeholder="填写拒绝原因" />
        </div>
        <table>
          <thead>
            <tr>
              <th>订单 ID（日期编号）</th>
              <th>会员 ID</th>
              <th>金额</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in recharges" :key="order.id">
              <td>{{ order.id }}</td>
              <td>{{ order.userId }}</td>
              <td>{{ order.amount }}</td>
              <td>{{ order.status }}</td>
              <td class="inline">
                <button class="primary" @click="approve(order.id)" :disabled="order.status !== 'PENDING'">通过</button>
                <button class="danger" @click="reject(order.id)" :disabled="order.status !== 'PENDING'">拒绝</button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="currentTab === 'orders'" class="card">
        <div class="inline" style="justify-content: space-between; margin-bottom: 12px">
          <h2 style="margin: 0">用户消费记录</h2>
          <button class="primary" @click="openCreateOrderModal">创建订单</button>
        </div>

        <div class="inline" style="margin-bottom: 12px">
          <small>按会员筛选：</small>
          <select v-model="orderFilterUserId" @change="loadFilteredOrders">
            <option value="all">全部会员</option>
            <option v-for="member in members" :key="member.id" :value="member.id">
              {{ member.nickname }} ({{ member.id }})
            </option>
          </select>
          <button class="primary" @click="loadFilteredOrders">查询</button>
        </div>

        <table>
          <thead>
            <tr>
              <th>订单号（日期编号）</th>
              <th>会员 ID</th>
              <th>产品类型</th>
              <th>标题</th>
              <th>原价</th>
              <th>会员价</th>
              <th>折扣</th>
              <th>效果图片</th>
              <th>订单日期</th>
              <th>备注</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in orders" :key="order.id">
              <td>{{ order.orderNo }}</td>
              <td>{{ order.userId }}</td>
              <td>{{ order.productType || '-' }}</td>
              <td>{{ order.title }}</td>
              <td>{{ order.originalPrice }}</td>
              <td>{{ order.finalPrice }}</td>
              <td>{{ order.discountRate }}</td>
              <td>
                <div v-if="order.effectImages.length > 0" class="thumb-list in-table">
                  <a v-for="img in order.effectImages" :key="img" :href="toAbsoluteImageUrl(img)" target="_blank" rel="noreferrer">
                    <img :src="toAbsoluteImageUrl(img)" alt="效果图" />
                  </a>
                </div>
                <span v-else>-</span>
              </td>
              <td>{{ order.orderDate }}</td>
              <td>{{ order.remark || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="currentTab === 'logs'" class="card">
        <h2>审计日志</h2>
        <table>
          <thead>
            <tr>
              <th>时间</th>
              <th>行为</th>
              <th>操作者</th>
              <th>对象</th>
              <th>详情</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in logs" :key="log.id">
              <td>{{ log.createdAt }}</td>
              <td>{{ getAuditActionLabel(log.action) }}</td>
              <td>{{ log.actorId }} ({{ log.actorRole }})</td>
              <td>{{ log.targetType }} / {{ log.targetId }}</td>
              <td class="metadata-cell">
                <div v-for="(line, index) in formatAuditMetadata(log.metadata)" :key="`${log.id}-${index}`">
                  {{ line }}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </main>
  </div>

  <div v-if="showOrderModal" class="modal-mask" @click.self="closeCreateOrderModal">
    <div class="modal-card">
      <h3>创建消费订单</h3>

      <label class="field-label">模糊查询会员</label>
      <input v-model="memberKeyword" placeholder="输入会员昵称 / 会员 ID" />

      <label class="field-label">选择会员</label>
      <select v-model="orderForm.userId">
        <option v-for="member in matchedMembers" :key="member.id" :value="member.id">
          {{ member.nickname }} ({{ member.id }})
        </option>
      </select>

      <label class="field-label">产品类型（可选）</label>
      <select v-model="orderForm.productType">
        <option value="">未选择</option>
        <option v-for="item in productTypeOptions" :key="item" :value="item">{{ item }}</option>
      </select>

      <label class="field-label">订单标题</label>
      <input v-model="orderForm.title" placeholder="例如：肩颈理疗" />

      <div class="inline-grid">
        <div>
          <label class="field-label">订单原价</label>
          <input v-model.number="orderForm.originalPrice" type="number" step="0.01" min="0.01" />
        </div>
        <div>
          <label class="field-label">折扣率</label>
          <input v-model.number="orderForm.discountRate" type="number" step="0.01" min="0.1" max="1" />
        </div>
      </div>

      <div class="inline-grid">
        <div>
          <label class="field-label">会员最终价（自动）</label>
          <input :value="finalPrice" readonly />
        </div>
        <div>
          <label class="field-label">会员默认折扣</label>
          <input :value="memberDiscountRate" readonly />
        </div>
      </div>

      <div class="inline-grid">
        <div>
          <label class="field-label">当前余额</label>
          <input :value="selectedMember?.balance ?? 0" readonly />
        </div>
        <div>
          <label class="field-label">下单后余额（预估）</label>
          <input :value="Math.max(0, Math.round(((selectedMember?.balance ?? 0) - finalPrice) * 100) / 100)" readonly />
        </div>
      </div>

      <small>
        当前下单折扣：{{ orderForm.discountRate }}
        <span v-if="selectedLevel">（{{ selectedLevel.name }}）</span>
      </small>

      <label class="field-label">订单日期</label>
      <input v-model="orderForm.orderDate" type="date" />

      <label class="field-label">效果图片（上传）</label>
      <input type="file" accept="image/*" multiple @change="uploadEffectImages" />
      <small v-if="uploadingImages">图片上传中...</small>
      <div v-if="orderForm.effectImages.length > 0" class="thumb-list">
        <div v-for="(img, index) in orderForm.effectImages" :key="img" class="thumb-item">
          <img :src="toAbsoluteImageUrl(img)" alt="effect" />
          <button class="danger mini" @click="removeImage(index)">删除</button>
        </div>
      </div>

      <label class="field-label">备注</label>
      <input v-model="orderForm.remark" placeholder="可选备注" />

      <div class="modal-actions">
        <button class="ghost-btn" @click="closeCreateOrderModal">取消</button>
        <div class="submit-wrap">
          <button class="primary" @click="showSubmitBubble = !showSubmitBubble">提交订单</button>
          <div v-if="showSubmitBubble" class="submit-bubble">
            <div>确认创建订单并扣减余额？</div>
            <div class="inline" style="margin-top: 8px">
              <button class="primary" @click="confirmCreateOrder">确认提交</button>
              <button class="ghost-btn" @click="showSubmitBubble = false">再检查一下</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
