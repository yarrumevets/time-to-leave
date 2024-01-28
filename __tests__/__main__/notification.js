/* eslint-disable no-undef */
'use strict';

const assert = require('assert');
const { createNotification, createLeaveNotification, updateDismiss, getDismiss } = require('../../js/notification.js');
const { getUserPreferences, savePreferences, resetPreferences } = require('../../js/user-preferences.js');
const { getDateStr } = require('../../js/date-aux.js');
import { app } from 'electron';

function buildTimeString(now)
{
    return `0${now.getHours()}`.slice(-2) + ':' + `0${now.getMinutes()}`.slice(-2);
}

describe('Notifications', function()
{
    describe('notify', () =>
    {
        beforeEach(() =>
        {
            // displays a notification in test fails if mocks are not restored
            jest.restoreAllMocks();
        });

        test('displays a notification in test', (done) =>
        {
            process.env.NODE_ENV = 'test';
            const notification = createNotification('test');
            // On Win32 the notification uses a different specification, with toastXml
            if (process.platform === 'win32')
            {
                expect(notification.toastXml).toMatch('<text>test</text>');
                expect(notification.toastXml).toMatch('<text>Time to Leave</text>');
            }
            else
            {
                assert.strictEqual(notification.body, 'test');
                assert.strictEqual(notification.title, 'Time to Leave');
            }
            notification.on('show', (event) =>
            {
                assert.notStrictEqual(event, undefined);
                // In Electron 25 the definition of Event changed and we can no longer
                // check information about the event sender
                notification.close();
                done();
            });
            if (process.env.CI && (process.platform === 'linux' || process.platform === 'darwin'))
            {
                // Linux/macos window notifications are not shown on CI
                // so this is a way to emit the same event that actually happens.
                // Timeout error is visible here https://github.com/thamara/time-to-leave/actions/runs/3488950409/jobs/5838419982
                notification.emit('show', {
                    sender: {
                        title: 'Time to Leave'
                    }
                });
            }
            else
            {
                notification.show();
            }
        });

        test('displays a notification in production', (done) =>
        {
            process.env.NODE_ENV = 'production';
            const notification = createNotification('production');
            // On Win32 the notification uses a different specification, with toastXml
            if (process.platform === 'win32')
            {
                expect(notification.toastXml).toMatch('<text>production</text>');
                expect(notification.toastXml).toMatch('<text>Time to Leave</text>');
            }
            else
            {
                assert.strictEqual(notification.body, 'production');
                assert.strictEqual(notification.title, 'Time to Leave');
            }
            notification.on('show', (event) =>
            {
                assert.notStrictEqual(event, undefined);
                // In Electron 25 the definition of Event changed and we can no longer
                // check information about the event sender
                notification.close();
                done();
            });
            if (process.env.CI && (process.platform === 'linux' || process.platform === 'darwin'))
            {
                // Linux/macos window notifications are not shown on CI
                // so this is a way to emit the same event that actually happens.
                // Timeout error is visible here https://github.com/thamara/time-to-leave/actions/runs/3488950409/jobs/5838419982
                notification.emit('show', {
                    sender: {
                        title: 'Time to Leave'
                    }
                });
            }
            else
            {
                notification.show();
            }
        });

    });

    describe('createLeaveNotification', () =>
    {
        test('Should fail when notifications are disabled', () =>
        {
            const preferences = getUserPreferences();
            preferences['notification'] = false;
            savePreferences(preferences);
            const notify = createLeaveNotification(true);
            assert.strictEqual(notify, false);
        });

        test('Should fail when leaveByElement is not found', () =>
        {
            const notify = createLeaveNotification(undefined);
            assert.strictEqual(notify, false);
        });

        test('Should fail when notifications have been dismissed', () =>
        {
            const now = new Date();
            const dateToday = getDateStr(now);
            updateDismiss(dateToday);
            const notify = createLeaveNotification(true);
            assert.strictEqual(notify, false);
        });

        test('Should fail when time is not valid', () =>
        {
            const notify = createLeaveNotification('33:90');
            assert.strictEqual(notify, false);
        });

        test('Should fail when time is in the future', () =>
        {
            jest.restoreAllMocks();
            const now = new Date();
            now.setMinutes(now.getMinutes() + 1);
            const notify = createLeaveNotification(buildTimeString(now));
            assert.strictEqual(notify, false);
        });

        test('Should fail when time is in the past', () =>
        {
            const now = new Date();
            now.setMinutes(now.getMinutes() - 9);
            const notify = createLeaveNotification(buildTimeString(now));
            assert.strictEqual(notify, false);
        });

        test('Should fail when repetition is disabled', () =>
        {
            const preferences = getUserPreferences();
            preferences['repetition'] = false;
            savePreferences(preferences);
            const now = new Date();
            now.setHours(now.getHours() - 1);
            const notify = createLeaveNotification(buildTimeString(now));
            assert.strictEqual(notify, false);
        });

        test('Should pass when time is correct and dismiss action is pressed', () =>
        {
            const now = new Date();
            const notify = createLeaveNotification(buildTimeString(now));
            assert.notStrictEqual(notify, undefined);
            assert.strictEqual(getDismiss(), null);
            assert.strictEqual(notify.listenerCount('action'), 1);
            assert.strictEqual(notify.listenerCount('close'), 1);
            assert.strictEqual(notify.listenerCount('click'), 1);
            notify.emit('action', 'dismiss');
            assert.strictEqual(getDismiss(), getDateStr(now));
        });

        test('Should pass when time is correct and other action is pressed', () =>
        {
            const now = new Date();
            const notify = createLeaveNotification(buildTimeString(now));
            assert.notStrictEqual(notify, undefined);
            assert.strictEqual(getDismiss(), null);
            assert.strictEqual(notify.listenerCount('action'), 1);
            assert.strictEqual(notify.listenerCount('close'), 1);
            assert.strictEqual(notify.listenerCount('click'), 1);
            notify.emit('action', '');
            assert.strictEqual(getDismiss(), null);
        });

        test('Should pass when time is correct and close is pressed', () =>
        {
            const now = new Date();
            const notify = createLeaveNotification(buildTimeString(now));
            assert.notStrictEqual(notify, undefined);
            assert.strictEqual(getDismiss(), null);
            assert.strictEqual(notify.listenerCount('action'), 1);
            assert.strictEqual(notify.listenerCount('close'), 1);
            assert.strictEqual(notify.listenerCount('click'), 1);
            notify.emit('close');
            assert.strictEqual(getDismiss(), getDateStr(now));
        });

        test('Should pass when time is correct and close is pressed', (done) =>
        {
            jest.spyOn(app, 'emit').mockImplementation((key) =>
            {
                assert.strictEqual(key, 'activate');
                done();
            });
            const now = new Date();
            const notify = createLeaveNotification(buildTimeString(now));
            assert.notStrictEqual(notify, undefined);
            assert.strictEqual(notify.listenerCount('action'), 1);
            assert.strictEqual(notify.listenerCount('close'), 1);
            assert.strictEqual(notify.listenerCount('click'), 1);
            notify.emit('click', 'Clicked on notification');
        });
    });

    afterEach(() =>
    {
        resetPreferences();
        updateDismiss(null);
    });
});

