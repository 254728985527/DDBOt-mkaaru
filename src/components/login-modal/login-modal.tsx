import React from 'react';
import Button from '@/components/shared_ui/button';
import Modal from '@/components/shared_ui/modal';
import Text from '@/components/shared_ui/text';
import { localize } from '@deriv-com/translations';
import './login-modal.scss';

type LoginModalProps = {
    is_open: boolean;
    on_close: () => void;
    on_deriv_login: () => void;
};

const LoginModal = ({ is_open, on_close, on_deriv_login }: LoginModalProps) => {
    const redirect_url = `${window.location.origin}/callback`;
    const website_url = window.location.origin;

    return (
        <Modal is_open={is_open} toggleModal={on_close} className='login-modal' width='52rem'>
            <Modal.Body>
                <div className='login-modal__content'>
                    <Text as='h2' align='center' weight='bold' className='login-modal__title'>
                        {localize('Log in to your account')}
                    </Text>
                    <Text as='p' align='center' className='login-modal__subtitle'>
                        {localize('Choose how you want to access your trading account.')}
                    </Text>

                    <button type='button' className='login-modal__option' onClick={on_deriv_login}>
                        <span className='login-modal__icon login-modal__icon--deriv' aria-hidden='true'>
                            d
                        </span>
                        <span className='login-modal__option-copy'>
                            <strong>{localize('Log in with Deriv')}</strong>
                            <span>{localize('Securely log in using your existing Deriv account.')}</span>
                        </span>
                        <span className='login-modal__arrow' aria-hidden='true'>
                            ›
                        </span>
                    </button>

                    <button
                        type='button'
                        className='login-modal__option'
                        onClick={() =>
                            window.open('https://app.deriv.com/account/api-token', '_blank', 'noopener,noreferrer')
                        }
                    >
                        <span className='login-modal__icon login-modal__icon--token' aria-hidden='true'>
                            ◇
                        </span>
                        <span className='login-modal__option-copy'>
                            <strong>{localize('Log in with token')}</strong>
                            <span>{localize('Use an API token from your Deriv account.')}</span>
                        </span>
                        <span className='login-modal__arrow' aria-hidden='true'>
                            ›
                        </span>
                    </button>

                    <div className='login-modal__integration'>
                        <Text as='h3' weight='bold'>
                            {localize('Application settings')}
                        </Text>
                        <Text as='p' size='xs'>
                            {localize('Use these URLs when configuring your Deriv application.')}
                        </Text>
                        <div className='login-modal__url-row'>
                            <span>{localize('Redirect URL')}</span>
                            <code>{redirect_url}</code>
                        </div>
                        <div className='login-modal__url-row'>
                            <span>{localize('Website URL')}</span>
                            <code>{website_url}</code>
                        </div>
                    </div>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <Button type='button' tertiary onClick={on_close} text={localize('Cancel')} />
            </Modal.Footer>
        </Modal>
    );
};

export default LoginModal;
