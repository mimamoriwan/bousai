import React from 'react';

const PrivacyPage = () => {
    return (
        <div className="card" style={{ margin: 'var(--spacing-md)', paddingBottom: 'var(--spacing-xl)' }}>
            <h2 style={{ marginBottom: 'var(--spacing-md)' }}>プライバシーポリシー</h2>
            <div style={{ lineHeight: '1.6', fontSize: '0.9rem', color: 'var(--color-text)' }}>
                <p style={{ marginBottom: 'var(--spacing-md)' }}>
                    「みまもりWAN」（以下「本サービス」）は、ユーザーの皆様のプライバシーならびに個人情報の保護を極めて重要な事項と認識しております。本プライバシーポリシーでは、本サービスにおけるユーザー情報の取り扱いについて定めます。
                </p>

                <h3 style={{ marginTop: 'var(--spacing-lg)', marginBottom: 'var(--spacing-sm)' }}>1. 取得する情報</h3>
                <p style={{ marginBottom: 'var(--spacing-sm)' }}>本サービスでは、以下の情報を取得・利用する場合があります。</p>
                <ul style={{ paddingLeft: '20px', marginBottom: 'var(--spacing-md)' }}>
                    <li><strong>アカウント・プロフィール情報:</strong> Googleアカウントを利用した認証に伴い取得する識別子、設定されたペットのプロフィール情報等の入力情報。</li>
                    <li><strong>位置情報 (GPS):</strong> スポット情報の投稿時、およびユーザーの現在地を中心としたマップ表示のために、端末の位置情報（緯度・経度）を取得します。</li>
                    <li><strong>カメラおよび画像データ:</strong> 機能提供のためにユーザーがアップロードを選択した写真データ。</li>
                    <li><strong>利用履歴:</strong> アプリの利用状況、投稿履歴、リアクション（「ありがとう」等）の履歴。</li>
                </ul>

                <h3 style={{ marginTop: 'var(--spacing-lg)', marginBottom: 'var(--spacing-sm)' }}>2. 情報の利用目的</h3>
                <p style={{ marginBottom: 'var(--spacing-sm)' }}>取得した情報は、以下の目的のためにのみ利用します。</p>
                <ul style={{ paddingLeft: '20px', marginBottom: 'var(--spacing-md)' }}>
                    <li>本サービスの提供、維持、保護および機能改善のため</li>
                    <li>ユーザー同士の情報共有（マップ上のピン表示、投稿情報の公開）を実現するため</li>
                    <li>本サービスに関するご案内、お問い合わせ等への対応のため</li>
                    <li>利用規約に違反する行為に対する対応のため</li>
                    <li>個人を識別できない形式に加工した統計データを作成するため</li>
                </ul>

                <h3 style={{ marginTop: 'var(--spacing-lg)', marginBottom: 'var(--spacing-sm)' }}>3. 情報等の第三者提供</h3>
                <p style={{ marginBottom: 'var(--spacing-md)' }}>
                    本サービスは、ユーザーご本人の同意を得ることなく、第三者に個人情報を提供することはありません。ただし、個人情報保護法その他の法令で認められる場合（警察等の公的機関からの適法な要請等）を除きます。また、マップ上に投稿された情報（写真、タイトル、位置情報など）は、共有目的として他のユーザーを含む一般に公開されます。
                </p>

                <h3 style={{ marginTop: 'var(--spacing-lg)', marginBottom: 'var(--spacing-sm)' }}>4. 安全管理措置</h3>
                <p style={{ marginBottom: 'var(--spacing-md)' }}>
                    ユーザーのデータは強固なセキュリティ環境（Google Firebase）を利用して保存および通信の暗号化を行い、不正アクセス、紛失、破壊、改ざん及び漏えいなどを防止するための適切な措置を講じています。
                </p>

                <h3 style={{ marginTop: 'var(--spacing-lg)', marginBottom: 'var(--spacing-sm)' }}>5. ブラウザベースの保存（PWA特有）</h3>
                <p style={{ marginBottom: 'var(--spacing-md)' }}>
                    アカウント未登録（ゲスト状態）の場合でも、「ありがとう」の送信履歴などの一時的な利用データを識別するため、お使いの端末・ブラウザのローカルストレージに固有の匿名IDを保存する場合があります。このIDは個人を特定するものではありません。
                </p>

                <h3 style={{ marginTop: 'var(--spacing-lg)', marginBottom: 'var(--spacing-sm)' }}>6. プライバシーポリシーの変更</h3>
                <p style={{ marginBottom: 'var(--spacing-md)' }}>
                    本ポリシーの内容は、ユーザーに通知することなく変更することができるものとします。変更後のプライバシーポリシーは、本サービス内に掲示した段階から効力を生じるものとします。
                </p>

                <p style={{ marginTop: 'var(--spacing-xl)', textAlign: 'right', fontSize: '0.8rem', color: 'var(--color-text-sub)' }}>
                    制定日: 2026年2月24日
                </p>
            </div>
        </div>
    );
};

export default PrivacyPage;
