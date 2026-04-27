jest.mock('nodemailer', () => {
  const sendMailFn = jest.fn();
  const getTestMessageUrlFn = jest.fn();
  return {
    __esModule: true,
    default: {
      createTransport: jest.fn(() => ({ sendMail: sendMailFn })),
      getTestMessageUrl: getTestMessageUrlFn,
      _sendMailFn: sendMailFn,
      _getTestMessageUrlFn: getTestMessageUrlFn,
    },
    createTransport: jest.fn(() => ({ sendMail: sendMailFn })),
    getTestMessageUrl: getTestMessageUrlFn,
    _sendMailFn: sendMailFn,
    _getTestMessageUrlFn: getTestMessageUrlFn,
  };
});

jest.mock('@/application/logging', () => ({
  logger: { info: jest.fn() },
}));

import nodemailer from 'nodemailer';
import { sendEmail } from '@/utils/mailer';
import { logger } from '@/application/logging';

const nodemailerMock = nodemailer as typeof nodemailer & {
  _sendMailFn: jest.Mock;
  _getTestMessageUrlFn: jest.Mock;
};
const mockSendMail = nodemailerMock._sendMailFn;
const mockGetTestMessageUrl = nodemailerMock._getTestMessageUrlFn;
const loggerMock = logger as jest.Mocked<typeof logger>;

beforeEach(() => jest.clearAllMocks());

describe('sendEmail', () => {
  const emailOptions = {
    to: 'recipient@example.com',
    subject: 'Test Subject',
    html: '<p>Hello</p>',
  };

  it('calls transporter.sendMail with correct from, to, subject, html fields', async () => {
    mockSendMail.mockResolvedValue({ messageId: 'test-id' });
    mockGetTestMessageUrl.mockReturnValue(false);

    await sendEmail(emailOptions);

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: expect.stringContaining('"PrimeCare"'),
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Hello</p>',
      })
    );
  });

  it('logs preview URL via logger.info when getTestMessageUrl returns a string URL', async () => {
    const previewUrl = 'https://ethereal.email/message/abc123';
    mockSendMail.mockResolvedValue({ messageId: 'test-id' });
    mockGetTestMessageUrl.mockReturnValue(previewUrl);

    await sendEmail(emailOptions);

    expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining(previewUrl));
  });

  it('does not call logger.info when getTestMessageUrl returns false', async () => {
    mockSendMail.mockResolvedValue({ messageId: 'test-id' });
    mockGetTestMessageUrl.mockReturnValue(false);

    await sendEmail(emailOptions);

    expect(loggerMock.info).not.toHaveBeenCalled();
  });

  it('propagates errors thrown by sendMail', async () => {
    mockSendMail.mockRejectedValue(new Error('SMTP connection refused'));

    await expect(sendEmail(emailOptions)).rejects.toThrow('SMTP connection refused');
  });
});
