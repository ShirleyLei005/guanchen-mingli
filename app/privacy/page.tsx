import type { Metadata } from "next";
import { PolicyShell } from "../policy-shell";

export const metadata: Metadata = {
  title: "隐私说明 · 观辰",
  description: "观辰如何收集、使用、存储与保护你的个人信息。",
};

export default function PrivacyPage() {
  return (
    <PolicyShell
      eyebrow="PRIVACY · 隐私与数据"
      title="隐私说明"
      intro="观辰只收集提供服务所必需的信息，并在明确、有限的目的内使用。以下说明帮助你了解数据从提交到删除的完整路径。"
    >
      <article className="policy-section">
        <h2>一、适用范围</h2>
        <p>本隐私说明适用于你访问观辰网站、注册账号、建立命盘、生成报告、参与问答、充值积分以及使用其他关联服务的过程。</p>
        <p>观辰提供的是传统文化娱乐与自我反思工具，不是医疗、心理、法律、投资或其他专业服务。你提交的任何出生资料都不会被用于公开展示或广告画像。</p>
      </article>

      <article className="policy-section">
        <h2>二、我们收集的信息</h2>
        <ul>
          <li><b>账号信息：</b>邮箱、昵称与密码哈希。密码经加盐哈希后存储，观辰不会保存明文密码。</li>
          <li><b>出生与排盘资料：</b>你填写的姓名或称呼、性别、出生日期与时间、出生地、经纬度、时区、历法以及真太阳时校正结果。</li>
          <li><b>使用记录：</b>命盘结果、报告主题、问答内容、聊天记录、积分流水、订单状态与支付状态。</li>
          <li><b>设备与安全信息：</b>IP 地址、浏览器与设备基本信息、会话标识和必要的安全日志，仅用于登录、防刷与账户安全。</li>
        </ul>
        <p>当前为沙箱支付阶段，观辰不会采集银行卡号、支付密码等真实支付敏感信息。正式支付渠道启用后，相关敏感信息由持牌支付机构直接处理。</p>
      </article>

      <article className="policy-section">
        <h2>三、信息的使用目的</h2>
        <ul>
          <li>建立并保存你的出生档案、命盘、报告与问答记录，以提供连续服务。</li>
          <li>维护积分账户、订单与支付状态，处理领取、扣减和充值。</li>
          <li>验证邮箱、识别滥用与安全风险，保护账号和平台安全。</li>
          <li>改进排盘与解读质量，在法律允许的范围内进行统计与异常监测。</li>
        </ul>
      </article>

      <article className="policy-section">
        <h2>四、AI 报告处理</h2>
        <p>生成深度报告时，系统会把经过排盘引擎计算的结构化盘面事实和你本次选择的主题、提问内容发送给 AI 服务提供商，用于生成解读文本。这些内容只服务于本次报告生成，不会用于广告或未经授权的其他用途。</p>
        <p>观辰会要求 AI 服务提供商按照其隐私与安全义务处理数据，但无法对第三方服务的内部行为作出绝对承诺。</p>
      </article>

      <article className="policy-section">
        <h2>五、Cookie 与本地存储</h2>
        <p>观辰使用 HttpOnly 会话 Cookie 保持登录状态，使用必要的本地存储维持页面状态。这些机制不用于第三方广告追踪。</p>
        <p>你可以清除浏览器 Cookie 或使用无痕模式访问，但清除后需要重新登录。</p>
      </article>

      <article className="policy-section">
        <h2>六、数据共享与披露</h2>
        <ul>
          <li>观辰不会出售、出租或向第三方营销你的个人信息。</li>
          <li>仅在提供服务所必需时，与云托管、AI 报告、支付等供应商共享最小必要数据。</li>
          <li>仅在法律明确要求、保护用户或平台安全所必需时，依法向监管或司法机关披露。</li>
        </ul>
      </article>

      <article className="policy-section">
        <h2>七、存储与安全</h2>
        <p>数据通过 HTTPS 加密传输，账号密码使用 PBKDF2 加盐哈希保存，会话令牌仅以哈希形式存储。数据库采用访问隔离与最小权限原则，并保留异常行为监测。</p>
        <p>没有任何网络或存储系统能保证绝对安全。若发生可能影响个人信息的安全事件，观辰会依法通知并采取补救措施。</p>
      </article>

      <article className="policy-section">
        <h2>八、保留期限与删除</h2>
        <p>个人信息将在实现本说明所述目的所需的期限内保留。你可以随时停止使用并请求删除账号及相关出生资料、命盘、报告和对话记录。</p>
        <p>因安全、税务或法律要求必须保留的数据，将在法定留存期内保留，期满后删除或匿名化。</p>
      </article>

      <article className="policy-section">
        <h2>九、未成年人</h2>
        <p>观辰服务面向有独立判断能力的成年人。未满 18 周岁者应在监护人知情并同意后使用，不应提交本人或他人的出生资料。</p>
      </article>

      <article className="policy-section">
        <h2>十、你的权利</h2>
        <ul>
          <li>访问并核对你提交的个人信息。</li>
          <li>更正不准确或过时的资料。</li>
          <li>请求删除账号及相关数据。</li>
          <li>撤回此前对数据处理方式的同意。</li>
        </ul>
        <p>如对数据处理有疑问，可通过观辰账号内功能或网站后续公布的联系渠道提出。处理请求前，观辰可能要求你完成身份核验。</p>
      </article>

      <article className="policy-section">
        <h2>十一、政策更新</h2>
        <p>本隐私说明可能随服务、法律或技术变化而调整。更新后会在此页面公布生效日期；涉及重要权利的变更，会通过显著方式提示。</p>
      </article>

      <p className="policy-meta">最后更新：2026 年 8 月 12 日</p>
    </PolicyShell>
  );
}
